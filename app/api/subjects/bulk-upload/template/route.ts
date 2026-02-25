import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/auth-utils'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templateRows = [
      {
        name: 'Mathematics',
        code: 'MATH',
      },
      {
        name: 'English Language',
        code: 'ENG',
      },
      {
        name: 'Science',
        code: 'SCI',
      },
      {
        name: 'Social Studies',
        code: 'SS',
      },
      {
        name: 'Physical Education',
        code: 'PE',
      },
    ]

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(templateRows)

    const instructions = [
      ['Required columns:', 'name'],
      ['Optional columns:', 'code'],
      ['Name:', 'Subject name (e.g., Mathematics, English Language)'],
      ['Code:', 'Short subject code (e.g., MATH, ENG, SCI)'],
    ]

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions)

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Subjects Template')
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="subjects-bulk-upload-template.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generating subjects template:', error)
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 })
  }
}
