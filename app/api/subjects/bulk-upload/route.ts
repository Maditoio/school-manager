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
  code?: string
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function mapRow(raw: Record<string, unknown>): RowData {
  const mapped: RowData = {}

  Object.entries(raw).forEach(([key, value]) => {
    const normalizedKey = normalizeHeader(key)
    const stringValue = value === undefined || value === null ? '' : String(value).trim()

    if (normalizedKey === 'name' || normalizedKey === 'subjectname') mapped.name = stringValue
    if (normalizedKey === 'code' || normalizedKey === 'subjectcode') mapped.code = stringValue
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

      if (!row.name) {
        errors.push({ row: rowNumber, error: 'Subject name is required' })
        continue
      }

      try {
        const subject = await prisma.subject.create({
          data: {
            schoolId: session.user.schoolId,
            name: row.name.trim(),
            code: row.code?.trim() || null,
          } as Prisma.SubjectUncheckedCreateInput,
        })

        createdIds.push(subject.id)
      } catch (rowError) {
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
          ? 'No subjects were imported. Review row errors.'
          : 'Bulk upload processed.',
    }

    if (createdIds.length === 0 && errors.length > 0) {
      return NextResponse.json(payload, { status: 400 })
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error uploading subjects in bulk:', error)
    return NextResponse.json({ error: 'Failed to upload subjects' }, { status: 500 })
  }
}
