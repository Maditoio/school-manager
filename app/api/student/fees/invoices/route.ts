import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { reconcileInvoiceStatuses } from '@/lib/fee-invoices'

// GET /api/student/fees/invoices — return this student's invoice history
export async function GET() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'STUDENT' || !session.user.studentId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const studentId = session.user.studentId

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true },
  })

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  // Recompute invoice statuses (overdue detection, etc.)
  await reconcileInvoiceStatuses(student.schoolId)

  const invoices = await prisma.feeInvoice.findMany({
    where: { studentId },
    include: {
      payments: { select: { id: true, amountPaid: true, paymentDate: true, paymentMethod: true } },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })

  const enriched = invoices.map((inv) => {
    const totalPaid = inv.payments.reduce((sum, p) => sum + p.amountPaid, 0)
    return {
      id: inv.id,
      periodType: inv.periodType,
      year: inv.year,
      month: inv.month,
      semester: inv.semester,
      amountDue: inv.amountDue,
      dueDate: inv.dueDate,
      status: inv.status,
      totalPaid,
      balance: Math.max(0, inv.amountDue - totalPaid),
      payments: inv.payments,
    }
  })

  return NextResponse.json({ invoices: enriched })
}
