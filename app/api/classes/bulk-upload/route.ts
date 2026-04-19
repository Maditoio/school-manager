import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024

type RowData = {
  name?: string
  academicYear?: string
  teacherEmail?: string
  capacity?: string
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function mapRow(raw: Record<string, unknown>): RowData {
  const mapped: RowData = {}

  Object.entries(raw).forEach(([key, value]) => {
    const normalizedKey = normalizeHeader(key)
    const stringValue = value === undefined || value === null ? '' : String(value).trim()

    if (normalizedKey === 'name' || normalizedKey === 'classname') mapped.name = stringValue
    if (normalizedKey === 'academicyear' || normalizedKey === 'year') mapped.academicYear = stringValue
    if (normalizedKey === 'teacheremail' || normalizedKey === 'teacher_email') mapped.teacherEmail = stringValue
    if (normalizedKey === 'capacity' || normalizedKey === 'maxcapacity') mapped.capacity = stringValue
  })

  return mapped
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

    // Fetch teachers for lookup
    const teachers = await prisma.user.findMany({
      where: {
        schoolId: session.user.schoolId,
        role: 'TEACHER',
      },
      select: { id: true, email: true },
    })

    const academicYears = await prisma.academic_years.findMany({
      where: {
        school_id: session.user.schoolId,
      },
      select: {
        id: true,
        year: true,
      },
    })

    const teacherByEmail = new Map(teachers.map((t) => [t.email.toLowerCase(), t.id]))
    const academicYearByYear = new Map(academicYears.map((y) => [y.year, y.id]))

    const createdIds: string[] = []
    const errors: Array<{ row: number; error: string }> = []

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2
      const row = mapRow(rows[index])

      if (!row.name || !row.academicYear) {
        errors.push({ row: rowNumber, error: 'Class name and academic year are required' })
        continue
      }

      const academicYear = parseInt(row.academicYear, 10)
      if (isNaN(academicYear)) {
        errors.push({ row: rowNumber, error: 'Academic year must be a valid number' })
        continue
      }

      const academicYearId = academicYearByYear.get(academicYear)
      if (!academicYearId) {
        errors.push({ row: rowNumber, error: `Academic year ${academicYear} does not exist. Create it first in Terms settings.` })
        continue
      }

      let teacherId: string | undefined = undefined
      if (row.teacherEmail) {
        const normalizedEmail = row.teacherEmail.toLowerCase()
        teacherId = teacherByEmail.get(normalizedEmail)
        if (!teacherId) {
          errors.push({ row: rowNumber, error: `Teacher with email ${row.teacherEmail} not found` })
          continue
        }
      }

      let capacity: number | undefined = undefined
      if (row.capacity) {
        const parsedCapacity = parseInt(row.capacity, 10)
        if (isNaN(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 500) {
          errors.push({ row: rowNumber, error: 'Capacity must be a number between 1 and 500' })
          continue
        }
        capacity = parsedCapacity
      }

      try {
        const cls = await prisma.class.create({
          data: {
            schoolId: session.user.schoolId,
            name: row.name.trim(),
            academicYear,
            academicYearId,
            teacherId,
            capacity,
          } as Prisma.ClassUncheckedCreateInput,
        })

        createdIds.push(cls.id)
      } catch (rowError) {
        if (
          rowError instanceof Prisma.PrismaClientKnownRequestError &&
          rowError.code === 'P2002'
        ) {
          errors.push({
            row: rowNumber,
            error: 'Class with this name already exists for the academic year.',
          })
          continue
        }

        const message = rowError instanceof Error ? rowError.message : 'Unknown row error'
        errors.push({ row: rowNumber, error: `Failed to import row: ${message}` })
      }
    }

    const payload = {
      success: true,
      created: createdIds.length,
      failed: errors.length,
      errors,
      message:
        createdIds.length === 0 && errors.length > 0
          ? 'No classes were imported. Review row errors.'
          : 'Bulk upload processed.',
    }

    if (createdIds.length === 0 && errors.length > 0) {
      return NextResponse.json(payload, { status: 400 })
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error uploading classes in bulk:', error)
    return NextResponse.json({ error: 'Failed to upload classes' }, { status: 500 })
  }
}
