import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { createFeeScheduleSchema, recordFeePaymentSchema } from '@/lib/validations'

async function resolveFeesUserContext(sessionUser: {
  id?: string | null
  email?: string | null
  schoolId?: string | null
  role?: string | null
}) {
  const fallbackEmail = typeof sessionUser?.email === 'string' ? sessionUser.email.trim() : ''
  const hasSessionId = typeof sessionUser?.id === 'string' && sessionUser.id.length > 0
  const hasSchoolId = typeof sessionUser?.schoolId === 'string' && sessionUser.schoolId.length > 0

  if (hasSessionId && hasSchoolId) {
    return {
      userId: sessionUser.id as string,
      schoolId: sessionUser.schoolId as string,
    }
  }

  if (!fallbackEmail) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: {
      email: fallbackEmail.toLowerCase(),
    },
    select: {
      id: true,
      schoolId: true,
      role: true,
    },
  })

  if (!user || user.role !== 'SCHOOL_ADMIN' || !user.schoolId) {
    return null
  }

  return {
    userId: user.id,
    schoolId: user.schoolId,
  }
}

function buildPeriodLabel(periodType: 'MONTHLY' | 'SEMESTER' | 'YEARLY', year: number, month: number | null, semester: number | null) {
  if (periodType === 'MONTHLY') {
    const monthName = new Date(year, (month || 1) - 1, 1).toLocaleDateString('en-US', { month: 'long' })
    return `${monthName} ${year}`
  }

  if (periodType === 'SEMESTER') {
    return `Semester ${semester || 1} ${year}`
  }

  return `Year ${year}`
}

function createPaymentNumber() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const t = String(now.getTime()).slice(-6)
  return `PAY-${y}${m}${d}-${t}`
}

// GET /api/fees - list fee schedules and payment status for selected period
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userContext = await resolveFeesUserContext(session.user)

    if (!userContext?.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const schoolId = userContext.schoolId
    const { searchParams } = new URL(request.url)
    const scheduleId = searchParams.get('scheduleId')

    const schedules = await prisma.feeSchedule.findMany({
      where: { schoolId },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      take: 36,
    })

    const selectedSchedule = scheduleId
      ? schedules.find((schedule) => schedule.id === scheduleId) || null
      : schedules[0] || null

    if (!selectedSchedule) {
      return NextResponse.json({
        schedules: [],
        selectedSchedule: null,
        summary: {
          studentsCount: 0,
          payingCount: 0,
          notPayingCount: 0,
          collectedAmount: 0,
          pendingAmount: 0,
        },
        studentStatuses: [],
        recentPayments: [],
      })
    }

    const students = await prisma.student.findMany({
      where: {
        schoolId,
        academicYear: selectedSchedule.year,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        classId: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })

    const classIds = Array.from(new Set(students.map((student) => student.classId).filter(Boolean)))

    const classes = classIds.length
      ? await prisma.class.findMany({
          where: {
            id: { in: classIds },
            schoolId,
          },
          select: {
            id: true,
            name: true,
          },
        })
      : []

    const classNameById = new Map(classes.map((classItem) => [classItem.id, classItem.name]))

    const payments = await prisma.feePayment.findMany({
      where: {
        schoolId,
        scheduleId: selectedSchedule.id,
      },
      select: {
        id: true,
        studentId: true,
        paymentNumber: true,
        amountPaid: true,
        paymentDate: true,
      },
      orderBy: { paymentDate: 'desc' },
    })

    const paymentStudentIds = Array.from(new Set(payments.map((payment) => payment.studentId)))
    const paymentStudents = paymentStudentIds.length
      ? await prisma.student.findMany({
          where: {
            schoolId,
            id: { in: paymentStudentIds },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            classId: true,
          },
        })
      : []

    const paymentStudentById = new Map(paymentStudents.map((student) => [student.id, student]))

    const paidByStudent = new Map<string, { totalPaid: number; lastPaymentDate: Date | null }>()

    for (const payment of payments) {
      const existing = paidByStudent.get(payment.studentId)
      if (existing) {
        existing.totalPaid += payment.amountPaid
        if (!existing.lastPaymentDate || payment.paymentDate > existing.lastPaymentDate) {
          existing.lastPaymentDate = payment.paymentDate
        }
      } else {
        paidByStudent.set(payment.studentId, {
          totalPaid: payment.amountPaid,
          lastPaymentDate: payment.paymentDate,
        })
      }
    }

    const studentStatuses = students.map((student) => {
      const studentPayments = paidByStudent.get(student.id)
      const totalPaid = studentPayments?.totalPaid || 0
      const balance = Math.max(selectedSchedule.amountDue - totalPaid, 0)
      const status = balance <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'NOT_PAID'

      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        className: classNameById.get(student.classId) || '-',
        amountDue: selectedSchedule.amountDue,
        totalPaid,
        balance,
        status,
        lastPaymentDate: studentPayments?.lastPaymentDate || null,
      }
    })

    const studentsCount = studentStatuses.length
    const payingCount = studentStatuses.filter((item) => item.status === 'PAID').length
    const collectedAmount = Number(payments.reduce((sum, payment) => sum + payment.amountPaid, 0).toFixed(2))
    const expectedAmount = Number((studentsCount * selectedSchedule.amountDue).toFixed(2))
    const pendingAmount = Number(Math.max(expectedAmount - collectedAmount, 0).toFixed(2))

    const recentPayments = payments.slice(0, 30).map((payment) => {
      const student = paymentStudentById.get(payment.studentId)
      return {
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        amountPaid: payment.amountPaid,
        paymentDate: payment.paymentDate,
        studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown Student',
        admissionNumber: student?.admissionNumber || null,
        className: student ? classNameById.get(student.classId) || '-' : '-',
      }
    })

    return NextResponse.json({
      schedules: schedules.map((schedule) => ({
        id: schedule.id,
        periodType: schedule.periodType,
        year: schedule.year,
        month: schedule.month,
        semester: schedule.semester,
        amountDue: schedule.amountDue,
        label: buildPeriodLabel(schedule.periodType, schedule.year, schedule.month, schedule.semester),
      })),
      selectedSchedule: {
        id: selectedSchedule.id,
        periodType: selectedSchedule.periodType,
        year: selectedSchedule.year,
        month: selectedSchedule.month,
        semester: selectedSchedule.semester,
        amountDue: selectedSchedule.amountDue,
        label: buildPeriodLabel(
          selectedSchedule.periodType,
          selectedSchedule.year,
          selectedSchedule.month,
          selectedSchedule.semester
        ),
      },
      summary: {
        studentsCount,
        payingCount,
        notPayingCount: studentsCount - payingCount,
        collectedAmount,
        pendingAmount,
      },
      studentStatuses,
      recentPayments,
    })
  } catch (error) {
    console.error('Error fetching fees:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Failed to fetch fees data',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    )
  }
}

// POST /api/fees - create schedule or record payment
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userContext = await resolveFeesUserContext(session.user)

    if (!userContext?.schoolId || !userContext.userId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const schoolId = userContext.schoolId
    const userId = userContext.userId
    const body = await request.json()
    const action = body?.action

    if (action === 'createSchedule') {
      const validation = createFeeScheduleSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.issues.map((issue) => issue.message).join(', ') },
          { status: 400 }
        )
      }

      const { periodType, year, month, semester, amountDue } = validation.data

      if (periodType === 'MONTHLY' && !month) {
        return NextResponse.json({ error: 'Month is required for monthly schedule' }, { status: 400 })
      }

      if (periodType === 'SEMESTER' && !semester) {
        return NextResponse.json({ error: 'Semester is required for semester schedule' }, { status: 400 })
      }

      if (periodType === 'YEARLY' && (month || semester)) {
        return NextResponse.json({ error: 'Yearly schedule should not include month or semester' }, { status: 400 })
      }

      const normalizedMonth = periodType === 'MONTHLY' ? month || null : null
      const normalizedSemester = periodType === 'SEMESTER' ? semester || null : null
      const existingSchedules = await prisma.feeSchedule.findMany({
        where: {
          schoolId,
          periodType,
          year,
          month: normalizedMonth,
          semester: normalizedSemester,
        },
        take: 1,
      })
      const existingSchedule = existingSchedules[0] ?? null

      const schedule = existingSchedule
        ? await prisma.feeSchedule.update({
            where: { id: existingSchedule.id },
            data: {
              amountDue,
              updatedAt: new Date(),
            },
          })
        : await prisma.feeSchedule.create({
            data: {
              schoolId,
              periodType,
              year,
              month: normalizedMonth,
              semester: normalizedSemester,
              amountDue,
              createdBy: userId,
            },
          })

      return NextResponse.json({ schedule }, { status: 201 })
    }

    if (action === 'recordPayment') {
      const validation = recordFeePaymentSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.issues.map((issue) => issue.message).join(', ') },
          { status: 400 }
        )
      }

      const { scheduleId, studentId, amountPaid, paymentDate, notes } = validation.data

      const [schedule, student] = await Promise.all([
        prisma.feeSchedule.findUnique({ where: { id: scheduleId } }),
        prisma.student.findUnique({ where: { id: studentId } }),
      ])

      if (!schedule || schedule.schoolId !== schoolId) {
        return NextResponse.json({ error: 'Fee schedule not found' }, { status: 404 })
      }

      if (!student || student.schoolId !== schoolId) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }

      const payment = await prisma.feePayment.create({
        data: {
          schoolId,
          scheduleId,
          studentId,
          paymentNumber: createPaymentNumber(),
          amountPaid,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          notes: notes || null,
          receivedBy: userId,
        },
      })

      return NextResponse.json({ payment }, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error handling fees:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Failed to process fee request',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    )
  }
}
