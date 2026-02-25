import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

type InvoicePageRow = {
  payment_id: string
  payment_number: string
  amount_paid: number
  payment_date: Date
  notes: string | null
  school_name: string
  student_first_name: string
  student_last_name: string
  student_admission_number: string | null
  class_name: string | null
  schedule_period_type: 'MONTHLY' | 'SEMESTER' | 'YEARLY'
  schedule_year: number
  schedule_month: number | null
  schedule_semester: number | null
  schedule_amount_due: number
  receiver_first_name: string | null
  receiver_last_name: string | null
}

function periodLabel(periodType: 'MONTHLY' | 'SEMESTER' | 'YEARLY', year: number, month: number | null, semester: number | null) {
  if (periodType === 'MONTHLY') {
    const monthName = new Date(year, (month || 1) - 1, 1).toLocaleDateString('en-US', { month: 'long' })
    return `${monthName} ${year}`
  }

  if (periodType === 'SEMESTER') {
    return `Semester ${semester || 1} ${year}`
  }

  return `Year ${year}`
}

async function getInvoiceData(paymentId: string, schoolId: string) {
  const rows = await prisma.$queryRaw<InvoicePageRow[]>`
    SELECT
      p.id AS payment_id,
      p.payment_number,
      p.amount_paid,
      p.payment_date,
      p.notes,
      sch.name AS school_name,
      st.first_name AS student_first_name,
      st.last_name AS student_last_name,
      st.admission_number AS student_admission_number,
      cls.name AS class_name,
      fs.period_type AS schedule_period_type,
      fs.year AS schedule_year,
      fs.month AS schedule_month,
      fs.semester AS schedule_semester,
      fs.amount_due AS schedule_amount_due,
      rec.first_name AS receiver_first_name,
      rec.last_name AS receiver_last_name
    FROM fee_payments p
    INNER JOIN schools sch ON sch.id = p.school_id
    INNER JOIN students st ON st.id = p.student_id
    LEFT JOIN classes cls ON cls.id = st.class_id
    INNER JOIN fee_schedules fs ON fs.id = p.schedule_id
    LEFT JOIN users rec ON rec.id = p.received_by
    WHERE p.id = ${paymentId}
      AND p.school_id = ${schoolId}
    LIMIT 1
  `

  const row = rows[0]
  if (!row) {
    return null
  }

  return {
    id: row.payment_id,
    paymentNumber: row.payment_number,
    amountPaid: Number(row.amount_paid),
    paymentDate: row.payment_date,
    notes: row.notes,
    school: {
      name: row.school_name,
    },
    student: {
      firstName: row.student_first_name,
      lastName: row.student_last_name,
      admissionNumber: row.student_admission_number,
      class: {
        name: row.class_name,
      },
    },
    schedule: {
      periodType: row.schedule_period_type,
      year: Number(row.schedule_year),
      month: row.schedule_month === null ? null : Number(row.schedule_month),
      semester: row.schedule_semester === null ? null : Number(row.schedule_semester),
      amountDue: Number(row.schedule_amount_due),
    },
    receiver: {
      firstName: row.receiver_first_name,
      lastName: row.receiver_last_name,
    },
  }
}

export default async function FeeInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session?.user || session.user.role !== 'SCHOOL_ADMIN') {
    redirect('/login')
  }

  if (!session.user.schoolId) {
    redirect('/login')
  }

  const { id } = await params
  const payment = await getInvoiceData(id, session.user.schoolId)

  if (!payment) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold ui-text-primary">Invoice not found</h1>
        <p className="mt-2 ui-text-secondary">The payment record could not be found for your school.</p>
      </div>
    )
  }

  const scheduleLabel = periodLabel(
    payment.schedule.periodType,
    payment.schedule.year,
    payment.schedule.month,
    payment.schedule.semester
  )

  const studentName = `${payment.student.firstName} ${payment.student.lastName}`
  const receivedBy = `${payment.receiver.firstName || ''} ${payment.receiver.lastName || ''}`.trim() || 'School Admin'

  return (
    <div className="mx-auto max-w-3xl p-6 print:p-2">
      <div className="ui-surface p-6 print:border-none print:shadow-none">
        <div className="flex items-start justify-between border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <h1 className="text-2xl font-bold ui-text-primary">Fee Payment Invoice</h1>
            <p className="mt-1 text-sm ui-text-secondary">{payment.school.name}</p>
          </div>
          <div className="text-right text-sm ui-text-secondary">
            <p>Payment No: <span className="font-semibold ui-text-primary">{payment.paymentNumber}</span></p>
            <p>Date: {new Date(payment.paymentDate).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide ui-text-secondary">Student Details</h2>
            <div className="mt-2 space-y-1 text-sm ui-text-primary">
              <p><span className="font-medium">Name:</span> {studentName}</p>
              <p><span className="font-medium">Admission No:</span> {payment.student.admissionNumber || '-'}</p>
              <p><span className="font-medium">Class:</span> {payment.student.class?.name || '-'}</p>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide ui-text-secondary">Payment Details</h2>
            <div className="mt-2 space-y-1 text-sm ui-text-primary">
              <p><span className="font-medium">Fee Period:</span> {scheduleLabel}</p>
              <p><span className="font-medium">Amount Due:</span> {payment.schedule.amountDue.toFixed(2)}</p>
              <p><span className="font-medium">Amount Paid:</span> {payment.amountPaid.toFixed(2)}</p>
              <p><span className="font-medium">Received By:</span> {receivedBy}</p>
            </div>
          </div>
        </div>

        {payment.notes && (
          <div
            className="mt-6 rounded-[10px] p-3 text-sm ui-text-secondary border"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}
          >
            <span className="font-medium ui-text-primary">Notes:</span> {payment.notes}
          </div>
        )}

        <div className="mt-8 text-right text-sm ui-text-secondary print:hidden">
          Use your browser print option to print or save this invoice as PDF.
        </div>
      </div>
    </div>
  )
}
