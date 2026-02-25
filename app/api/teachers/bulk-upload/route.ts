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
const DEFAULT_TEACHER_PASSWORD = 'default12345'

type RowData = {
  title?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  password?: string
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function mapRow(raw: Record<string, unknown>): RowData {
  const mapped: RowData = {}

  Object.entries(raw).forEach(([key, value]) => {
    const normalizedKey = normalizeHeader(key)
    const stringValue = value === undefined || value === null ? '' : String(value).trim()

    if (normalizedKey === 'title') mapped.title = stringValue
    if (normalizedKey === 'firstname' || normalizedKey === 'first_name') mapped.firstName = stringValue
    if (normalizedKey === 'lastname' || normalizedKey === 'last_name') mapped.lastName = stringValue
    if (normalizedKey === 'email') mapped.email = stringValue
    if (normalizedKey === 'phone') mapped.phone = stringValue
    if (normalizedKey === 'password') mapped.password = stringValue
  })

  return mapped
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
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

    const createdIds: string[] = []
    const errors: Array<{ row: number; error: string }> = []

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2
      const row = mapRow(rows[index])

      if (!row.firstName || !row.lastName || !row.email) {
        errors.push({ row: rowNumber, error: 'Title, first name, last name, and email are required' })
        continue
      }

      const normalizedEmail = row.email.trim().toLowerCase()

      // Check if email already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      })

      if (existingUser) {
        errors.push({ row: rowNumber, error: 'Email already exists in system' })
        continue
      }

      try {
        const passwordToUse = row.password && row.password.trim() ? row.password.trim() : DEFAULT_TEACHER_PASSWORD
        const hashedPassword = await hash(passwordToUse, 12)

        const teacher = await prisma.user.create({
          data: {
            schoolId: session.user.schoolId,
            role: 'TEACHER',
            email: normalizedEmail,
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            title: row.title?.trim() || null,
            phone: row.phone?.trim() || null,
            password: hashedPassword,
            mustResetPassword: !row.password || !row.password.trim() ? true : false,
          } as Prisma.UserUncheckedCreateInput,
        })

        createdIds.push(teacher.id)
      } catch (rowError) {
        if (
          rowError instanceof Prisma.PrismaClientKnownRequestError &&
          rowError.code === 'P2002'
        ) {
          errors.push({
            row: rowNumber,
            error: 'Email already exists in system.',
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
          ? 'No teachers were imported. Review row errors.'
          : 'Bulk upload processed.',
    }

    if (createdIds.length === 0 && errors.length > 0) {
      return NextResponse.json(payload, { status: 400 })
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error uploading teachers in bulk:', error)
    return NextResponse.json({ error: 'Failed to upload teachers' }, { status: 500 })
  }
}
