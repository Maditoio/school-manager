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
        name: 'Grade 5A',
        academicYear: '2024',
        teacherEmail: 'john.smith@school.com',
        capacity: '40',
      },
      {
        name: 'Grade 5B',
        academicYear: '2024',
        teacherEmail: 'jane.johnson@school.com',
        capacity: '40',
      },
      {
        name: 'Grade 6A',
        academicYear: '2024',
        teacherEmail: '',
        capacity: '',
      },
    ]

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(templateRows)

    const instructions = [
      ['Required columns:', 'name, academicYear'],
      ['Optional columns:', 'teacherEmail, capacity (leave blank to assign later)'],
      ['Academic year:', 'Must be a valid year number (e.g., 2024, 2025)'],
      ['Teacher email:', 'Email must match an existing teacher in the system'],
      ['Teacher not required:', 'You can leave teacherEmail blank and assign later'],
      ['Capacity:', 'If provided, must be between 1 and 500'],
    ]

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions)

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Classes Template')
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="classes-bulk-upload-template.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generating classes template:', error)
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 })
  }
}
