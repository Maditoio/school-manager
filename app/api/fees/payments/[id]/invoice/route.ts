import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

type InvoiceApiRow = {
  payment_id: string
  payment_number: string
  amount_paid: number
  payment_date: Date
  notes: string | null
  receipt_url: string | null
  receipt_file_name: string | null
  receipt_mime_type: string | null
  school_id: string
  school_name: string
  student_id: string
  student_first_name: string
  student_last_name: string
  student_admission_number: string | null
  class_name: string | null
  schedule_id: string
  schedule_period_type: 'MONTHLY' | 'SEMESTER' | 'YEARLY'
  schedule_year: number
  schedule_month: number | null
  schedule_semester: number | null
  schedule_amount_due: number
}

async function resolveSchoolId(sessionUser: {
  id?: string | null
  email?: string | null
  schoolId?: string | null
}) {
  if (sessionUser.schoolId) {
    return sessionUser.schoolId
  }

  if (sessionUser.id) {
    const byId = await prisma.$queryRaw<Array<{ school_id: string | null }>>`
      SELECT school_id
      FROM users
      WHERE id = ${sessionUser.id}
      LIMIT 1
    `

    if (byId[0]?.school_id) {
      return byId[0].school_id
    }
  }

  if (sessionUser.email) {
    const byEmail = await prisma.$queryRaw<Array<{ school_id: string | null }>>`
      SELECT school_id
      FROM users
      WHERE LOWER(email) = LOWER(${sessionUser.email})
      LIMIT 1
    `

    if (byEmail[0]?.school_id) {
      return byEmail[0].school_id
    }
  }

  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE', 'FINANCE_MANAGER', 'STUDENT'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schoolId = await resolveSchoolId(session.user)

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const { id } = await params
    const isStudent = session.user.role === 'STUDENT'
    const studentIdFilter = isStudent ? session.user.studentId : null

    if (isStudent && !studentIdFilter) {
      return NextResponse.json({ error: 'Student context required' }, { status: 400 })
    }

    const rows = await prisma.$queryRaw<InvoiceApiRow[]>`
      SELECT
        p.id AS payment_id,
        p.payment_number,
        p.amount_paid,
        p.payment_date,
        p.notes,
        p.receipt_url,
        p.receipt_file_name,
        p.receipt_mime_type,
        sch.id AS school_id,
        sch.name AS school_name,
        st.id AS student_id,
        st.first_name AS student_first_name,
        st.last_name AS student_last_name,
        st.admission_number AS student_admission_number,
        cls.name AS class_name,
        fs.id AS schedule_id,
        fs.period_type AS schedule_period_type,
        fs.year AS schedule_year,
        fs.month AS schedule_month,
        fs.semester AS schedule_semester,
        fs.amount_due AS schedule_amount_due
      FROM fee_payments p
      INNER JOIN schools sch ON sch.id = p.school_id
      INNER JOIN students st ON st.id = p.student_id
      LEFT JOIN classes cls ON cls.id = st.class_id
      INNER JOIN fee_schedules fs ON fs.id = p.schedule_id
      WHERE p.id = ${id}
        AND p.school_id = ${schoolId}
        AND (${studentIdFilter}::uuid IS NULL OR p.student_id = ${studentIdFilter}::uuid)
      LIMIT 1
    `

    const row = rows[0]
    const payment = row
      ? {
          id: row.payment_id,
          paymentNumber: row.payment_number,
          amountPaid: Number(row.amount_paid),
          paymentDate: row.payment_date,
          notes: row.notes,
          receiptUrl: row.receipt_url,
          receiptFileName: row.receipt_file_name,
          receiptMimeType: row.receipt_mime_type,
          school: {
            id: row.school_id,
            name: row.school_name,
          },
          student: {
            id: row.student_id,
            firstName: row.student_first_name,
            lastName: row.student_last_name,
            admissionNumber: row.student_admission_number,
            class: {
              name: row.class_name,
            },
          },
          schedule: {
            id: row.schedule_id,
            periodType: row.schedule_period_type,
            year: Number(row.schedule_year),
            month: row.schedule_month === null ? null : Number(row.schedule_month),
            semester: row.schedule_semester === null ? null : Number(row.schedule_semester),
            amountDue: Number(row.schedule_amount_due),
          },
        }
      : null

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    return NextResponse.json({ payment })
  } catch (error) {
    console.error('Error fetching fee invoice:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Failed to fetch invoice',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    )
  }
}
