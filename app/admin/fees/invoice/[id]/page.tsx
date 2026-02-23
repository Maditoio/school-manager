import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

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
  return prisma.feePayment.findFirst({
    where: {
      id: paymentId,
      schoolId,
    },
    include: {
      school: {
        select: {
          name: true,
        },
      },
      student: {
        select: {
          firstName: true,
          lastName: true,
          admissionNumber: true,
          class: {
            select: {
              name: true,
            },
          },
        },
      },
      schedule: {
        select: {
          periodType: true,
          year: true,
          month: true,
          semester: true,
          amountDue: true,
        },
      },
      receiver: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  })
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
