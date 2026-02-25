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
        title: 'Mr.',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@school.com',
        phone: '+1234567890',
        password: '',
      },
      {
        title: 'Mrs.',
        firstName: 'Jane',
        lastName: 'Johnson',
        email: 'jane.johnson@school.com',
        phone: '+1234567891',
        password: '',
      },
    ]

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(templateRows)

    const instructions = [
      ['Required columns:', 'title, firstName, lastName, email, phone'],
      ['Optional columns:', 'password (if empty, default12345 will be used)'],
      ['Default password:', 'If no password provided, system uses: default12345'],
      ['Title examples:', 'Mr., Mrs., Ms., Dr., Prof.'],
      ['Email:', 'Must be unique across the system'],
      ['Must reset password:', 'If password is empty, teacher must reset on first login'],
    ]

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions)

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Teachers Template')
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="teachers-bulk-upload-template.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generating teachers template:', error)
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 })
  }
}
