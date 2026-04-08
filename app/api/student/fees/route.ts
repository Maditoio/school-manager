import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'STUDENT' || !session.user.studentId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const studentId = session.user.studentId

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { classId: true, schoolId: true },
  })

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  // Get fee schedules applicable to this student's class or school-wide (null classId)
  const schedules = await prisma.feeSchedule.findMany({
    where: {
      schoolId: student.schoolId,
      status: 'APPROVED',
      OR: [
        { classId: student.classId },
        { classId: null },
      ],
    },
    include: {
      payments: {
        where: { studentId },
        orderBy: { paymentDate: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const enriched = schedules.map(schedule => {
    const totalPaid = schedule.payments.reduce((sum: number, p: { amountPaid: number }) => sum + p.amountPaid, 0)
    const balance = schedule.amountDue - totalPaid
    const status = balance <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID'
    return { ...schedule, totalPaid, balance, feeStatus: status }
  })

  const totalOutstanding = enriched.reduce((sum, s) => sum + Math.max(0, s.balance), 0)

  return NextResponse.json({ schedules: enriched, totalOutstanding })
}
