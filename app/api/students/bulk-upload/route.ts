import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { Prisma } from '@prisma/client'
import { hash } from 'bcryptjs'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024
const DEFAULT_PARENT_PASSWORD = 'parent1234'

type RowData = {
  firstName?: string
  lastName?: string
  admissionNumber?: string
  dateOfBirth?: string
  className?: string
  classId?: string
  parentName?: string
  parentEmail?: string
  parentPhone?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function mapRow(raw: Record<string, unknown>): RowData {
  const mapped: RowData = {}

  Object.entries(raw).forEach(([key, value]) => {
    const normalizedKey = normalizeHeader(key)
    const stringValue = value === undefined || value === null ? '' : String(value).trim()

    if (normalizedKey === 'firstname' || normalizedKey === 'first_name') mapped.firstName = stringValue
    if (normalizedKey === 'lastname' || normalizedKey === 'last_name') mapped.lastName = stringValue
    if (normalizedKey === 'admissionnumber' || normalizedKey === 'admission_no') mapped.admissionNumber = stringValue
    if (normalizedKey === 'dateofbirth' || normalizedKey === 'dob') mapped.dateOfBirth = stringValue
    if (normalizedKey === 'classname' || normalizedKey === 'class') mapped.className = stringValue
    if (normalizedKey === 'classid') mapped.classId = stringValue
    if (normalizedKey === 'parentname') mapped.parentName = stringValue
    if (normalizedKey === 'parentemail') mapped.parentEmail = stringValue
    if (normalizedKey === 'parentphone') mapped.parentPhone = stringValue
    if (normalizedKey === 'emergencycontactname') mapped.emergencyContactName = stringValue
    if (normalizedKey === 'emergencycontactphone' || normalizedKey === 'emergencyphone') mapped.emergencyContactPhone = stringValue
  })

  return mapped
}

function splitParentName(name?: string | null) {
  const normalized = name?.trim() || 'Parent'
  const parts = normalized.split(/\s+/).filter(Boolean)
  const firstName = parts[0] || 'Parent'
  const lastName = parts.slice(1).join(' ') || 'Guardian'
  return { firstName, lastName }
}

async function ensureParentUser(params: {
  schoolId: string
  parentEmail?: string | null
  parentName?: string | null
}): Promise<{ parentId?: string; skipReason?: string }> {
  const normalizedEmail = params.parentEmail?.trim().toLowerCase() || ''
  if (!normalizedEmail) {
    return {}
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      schoolId: true,
      role: true,
    },
  })

  if (existingByEmail) {
    if (existingByEmail.role !== 'PARENT') {
      return {
        skipReason: 'Parent email already belongs to a non-parent account. Row skipped.',
      }
    }

    return { parentId: existingByEmail.id }
  }

  const existingParent = await prisma.user.findFirst({
    where: {
      schoolId: params.schoolId,
      role: 'PARENT',
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  })

  if (existingParent) {
    return { parentId: existingParent.id }
  }

  const { firstName, lastName } = splitParentName(params.parentName)
  const hashedPassword = await hash(DEFAULT_PARENT_PASSWORD, 12)

  const parentUser = await prisma.user.create({
    data: {
      schoolId: params.schoolId,
      role: 'PARENT',
      email: normalizedEmail,
      firstName,
      lastName,
      password: hashedPassword,
    },
    select: { id: true },
  })

  await prisma.$executeRaw`
    UPDATE users
    SET must_reset_password = true
    WHERE id = ${parentUser.id}
  `

  return { parentId: parentUser.id }
}

type AdmissionNumberState = {
  usedCodes: Set<string>
}

async function loadAdmissionNumberState(
  schoolId: string,
  academicYear: number
): Promise<AdmissionNumberState> {
  const prefix = `ADM-${academicYear}-`
  const existingAdmissionNumbers = await prisma.student.findMany({
    where: {
      schoolId,
      academicYear,
      admissionNumber: {
        startsWith: prefix,
      },
    },
    select: {
      admissionNumber: true,
    },
  })

  const usedCodes = new Set<string>()
  const pattern = new RegExp(`^ADM-${academicYear}-(\\d{4})$`)

  for (const row of existingAdmissionNumbers) {
    const admissionNumber = row.admissionNumber || ''
    const match = admissionNumber.match(pattern)
    if (match?.[1]) {
      usedCodes.add(match[1])
    }
  }

  return { usedCodes }
}

function reserveNextAdmissionNumber(state: AdmissionNumberState, academicYear: number): string {
  const prefix = `ADM-${academicYear}-`
  for (let number = 0; number < 10000; number += 1) {
    const code = String(number).padStart(4, '0')
    if (!state.usedCodes.has(code)) {
      state.usedCodes.add(code)
      return `${prefix}${code}`
    }
  }

  throw new Error(`Admission number space exhausted for academic year ${academicYear}`)
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Excel file is required' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ error: 'Only .xlsx or .xls files are supported' }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File is too large. Maximum supported size is 5MB.' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const workbook = XLSX.read(bytes, { type: 'array' })
    const firstSheet = workbook.SheetNames[0]

    if (!firstSheet) {
      return NextResponse.json({ error: 'No worksheet found in file' }, { status: 400 })
    }

    const sheet = workbook.Sheets[firstSheet]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    const classes = await prisma.class.findMany({
      where: { schoolId: session.user.schoolId },
      select: { id: true, name: true, academicYear: true },
    })

    if (classes.length === 0) {
      return NextResponse.json(
        { error: 'No classes found. Create at least one class before bulk upload.' },
        { status: 400 }
      )
    }

    const classById = new Map(classes.map((c) => [c.id, c.id]))
    const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c.id]))

    const createdIds: string[] = []
    const skippedRows: Array<{ row: number; reason: string }> = []
    const errors: Array<{ row: number; error: string }> = []
    const admissionNumberStateByYear = new Map<number, AdmissionNumberState>()

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2
      const row = mapRow(rows[index])

      if (!row.firstName || !row.lastName) {
        errors.push({ row: rowNumber, error: 'First name and last name are required' })
        continue
      }

      const primaryClassId = row.classId
        ? classById.get(row.classId)
        : row.className
        ? classByName.get(row.className.trim().toLowerCase())
        : undefined

      const primaryClass = classes.find((item) => item.id === primaryClassId)

      if (!primaryClass) {
        errors.push({ row: rowNumber, error: 'Valid className or classId is required' })
        continue
      }

      try {
        const normalizedParentEmail = row.parentEmail ? row.parentEmail.trim().toLowerCase() : ''
        const parentResolution = await ensureParentUser({
          schoolId: session.user.schoolId,
          parentEmail: normalizedParentEmail,
          parentName: row.parentName,
        })

        if (parentResolution.skipReason) {
          skippedRows.push({ row: rowNumber, reason: parentResolution.skipReason })
          continue
        }

        const parentId = parentResolution.parentId

        const normalizedDateOfBirth = row.dateOfBirth?.trim() || ''

        if (normalizedDateOfBirth && Number.isNaN(Date.parse(normalizedDateOfBirth))) {
          errors.push({ row: rowNumber, error: 'Invalid dateOfBirth format. Use YYYY-MM-DD.' })
          continue
        }

        let state = admissionNumberStateByYear.get(primaryClass.academicYear)
        if (!state) {
          state = await loadAdmissionNumberState(session.user.schoolId, primaryClass.academicYear)
          admissionNumberStateByYear.set(primaryClass.academicYear, state)
        }

        let student: { id: string } | null = null
        let retries = 0

        while (!student && retries < 5) {
          const generatedAdmissionNumber = reserveNextAdmissionNumber(state, primaryClass.academicYear)

          try {
            student = await prisma.student.create({
              data: {
                schoolId: session.user.schoolId,
                firstName: row.firstName,
                lastName: row.lastName,
                admissionNumber: generatedAdmissionNumber,
                dateOfBirth: normalizedDateOfBirth ? new Date(normalizedDateOfBirth) : null,
                classId: primaryClass.id,
                academicYear: primaryClass.academicYear,
                parentId,
                parentName: row.parentName?.trim() || null,
                parentEmail: normalizedParentEmail || null,
                parentPhone: row.parentPhone?.trim() || null,
                emergencyContactName: row.emergencyContactName?.trim() || null,
                emergencyContactPhone: row.emergencyContactPhone?.trim() || null,
              } as Prisma.StudentUncheckedCreateInput,
              select: { id: true },
            })
          } catch (createError) {
            if (
              createError instanceof Prisma.PrismaClientKnownRequestError &&
              createError.code === 'P2002'
            ) {
              retries += 1
              continue
            }
            throw createError
          }
        }

        if (!student) {
          throw new Error('Could not allocate a unique admission number. Please retry upload.')
        }

        createdIds.push(student.id)
      } catch (rowError) {
        if (
          rowError instanceof Prisma.PrismaClientKnownRequestError &&
          rowError.code === 'P2002'
        ) {
          const target = String((rowError.meta as { target?: unknown } | undefined)?.target || '')
          if (target.includes('email')) {
            skippedRows.push({
              row: rowNumber,
              reason: 'Parent email already belongs to another user account. Row skipped.',
            })
            continue
          }

          if (target.includes('admission_number')) {
            skippedRows.push({
              row: rowNumber,
              reason: 'Student already exists for this academic year. Row skipped.',
            })
            continue
          }

          errors.push({
            row: rowNumber,
            error: 'Duplicate student for this academic year (admission number must be unique).',
          })
          continue
        }

        const message = rowError instanceof Error ? rowError.message : 'Unknown row error'
        errors.push({ row: rowNumber, error: `Failed to import row: ${message}` })
      }
    }

    const payload = {
      success: createdIds.length > 0,
      created: createdIds.length,
      skipped: skippedRows.length,
      failed: errors.length,
      skippedRows,
      errors,
      message: 'Bulk upload processed.',
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error uploading students in bulk:', error)
    return NextResponse.json({ error: 'Failed to upload students' }, { status: 500 })
  }
}
