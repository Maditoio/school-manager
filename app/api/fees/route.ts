import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { createFeeScheduleSchema, recordFeePaymentSchema } from '@/lib/validations'
import { CurrentTermNotSetError, getCurrentEditableTermForSchool, TermLockedError } from '@/lib/term-utils'

type FeeScheduleRow = {
  id: string
  school_id: string
  period_type: 'MONTHLY' | 'SEMESTER' | 'YEARLY'
  year: number
  month: number | null
  semester: number | null
  amount_due: number
  created_by: string
  created_at: Date
  updated_at: Date
}

type FeePaymentRow = {
  id: string
  school_id: string
  schedule_id: string
  student_id: string
  payment_method: 'CASH' | 'BANK_TRANSFER' | 'M_PESA' | 'ORANGE_MONEY' | 'OTHER'
  payment_number: string
  amount_paid: number
  payment_date: Date
}

function getPrismaDelegates() {
  const prismaUnsafe = prisma as unknown as {
    feeSchedule?: {
      findMany?: (...args: unknown[]) => Promise<unknown>
      findUnique?: (...args: unknown[]) => Promise<unknown>
      update?: (...args: unknown[]) => Promise<unknown>
      create?: (...args: unknown[]) => Promise<unknown>
    }
    feePayment?: {
      findMany?: (...args: unknown[]) => Promise<unknown>
      create?: (...args: unknown[]) => Promise<unknown>
    }
    student?: {
      findMany?: (...args: unknown[]) => Promise<unknown>
      findUnique?: (...args: unknown[]) => Promise<unknown>
    }
    class?: {
      findMany?: (...args: unknown[]) => Promise<unknown>
    }
  }

  return prismaUnsafe
}

function normalizeScheduleRow(row: FeeScheduleRow) {
  return {
    id: row.id,
    schoolId: row.school_id,
    periodType: row.period_type,
    year: Number(row.year),
    month: row.month === null ? null : Number(row.month),
    semester: row.semester === null ? null : Number(row.semester),
    amountDue: Number(row.amount_due),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizePaymentRow(row: FeePaymentRow) {
  return {
    id: row.id,
    schoolId: row.school_id,
    scheduleId: row.schedule_id,
    studentId: row.student_id,
    paymentMethod: row.payment_method,
    paymentNumber: row.payment_number,
    amountPaid: Number(row.amount_paid),
    paymentDate: new Date(row.payment_date),
  }
}

async function getFeeSchedulesForSchool(schoolId: string) {
  const delegates = getPrismaDelegates()
  if (delegates.feeSchedule?.findMany) {
    return (await prisma.feeSchedule.findMany({
      where: { schoolId },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      take: 36,
    })) as Array<{
      id: string
      schoolId: string
      periodType: 'MONTHLY' | 'SEMESTER' | 'YEARLY'
      year: number
      month: number | null
      semester: number | null
      amountDue: number
      createdBy: string
      createdAt: Date
      updatedAt: Date
    }>
  }

  const rows = await prisma.$queryRaw<FeeScheduleRow[]>`
    SELECT id, school_id, period_type, year, month, semester, amount_due, created_by, created_at, updated_at
    FROM fee_schedules
    WHERE school_id = ${schoolId}
    ORDER BY year DESC, created_at DESC
    LIMIT 36
  `

  return rows.map(normalizeScheduleRow)
}

async function getFeePaymentsForSchedule(schoolId: string, scheduleId: string) {
  const delegates = getPrismaDelegates()
  if (delegates.feePayment?.findMany) {
    return (await prisma.feePayment.findMany({
      where: {
        schoolId,
        scheduleId,
      },
      select: {
        id: true,
        studentId: true,
        payment_method: true,
        paymentNumber: true,
        amountPaid: true,
        paymentDate: true,
      },
      orderBy: { paymentDate: 'desc' },
    })).map((payment) => ({
      id: payment.id,
      studentId: payment.studentId,
      paymentMethod: payment.payment_method,
      paymentNumber: payment.paymentNumber,
      amountPaid: payment.amountPaid,
      paymentDate: payment.paymentDate,
    }))
  }

  const rows = await prisma.$queryRaw<FeePaymentRow[]>`
    SELECT id, school_id, schedule_id, student_id, payment_method, payment_number, amount_paid, payment_date
    FROM fee_payments
    WHERE school_id = ${schoolId} AND schedule_id = ${scheduleId}
    ORDER BY payment_date DESC
  `

  return rows.map((row) => {
    const payment = normalizePaymentRow(row)
    return {
      id: payment.id,
      studentId: payment.studentId,
      paymentMethod: payment.paymentMethod,
      paymentNumber: payment.paymentNumber,
      amountPaid: payment.amountPaid,
      paymentDate: payment.paymentDate,
    }
  })
}

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

    const schedules = await getFeeSchedulesForSchool(schoolId)

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

    const payments = await getFeePaymentsForSchedule(schoolId, selectedSchedule.id)

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
        paymentMethod: payment.paymentMethod,
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
      const delegates = getPrismaDelegates()

      let schedule: {
        id: string
        schoolId: string
        periodType: 'MONTHLY' | 'SEMESTER' | 'YEARLY'
        year: number
        month: number | null
        semester: number | null
        amountDue: number
      }

      if (delegates.feeSchedule?.findMany && delegates.feeSchedule?.update && delegates.feeSchedule?.create) {
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

        schedule = existingSchedule
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
      } else {
        const existingRows = await prisma.$queryRaw<FeeScheduleRow[]>`
          SELECT id, school_id, period_type, year, month, semester, amount_due, created_by, created_at, updated_at
          FROM fee_schedules
          WHERE school_id = ${schoolId}
            AND period_type = ${periodType}::"FeePeriodType"
            AND year = ${year}
            AND month IS NOT DISTINCT FROM ${normalizedMonth}
            AND semester IS NOT DISTINCT FROM ${normalizedSemester}
          LIMIT 1
        `

        if (existingRows.length > 0) {
          const updatedRows = await prisma.$queryRaw<FeeScheduleRow[]>`
            UPDATE fee_schedules
            SET amount_due = ${amountDue}, updated_at = NOW()
            WHERE id = ${existingRows[0].id}
            RETURNING id, school_id, period_type, year, month, semester, amount_due, created_by, created_at, updated_at
          `
          schedule = normalizeScheduleRow(updatedRows[0])
        } else {
          const insertedId = crypto.randomUUID()
          const insertedRows = await prisma.$queryRaw<FeeScheduleRow[]>`
            INSERT INTO fee_schedules (id, school_id, period_type, year, month, semester, amount_due, created_by, created_at, updated_at)
            VALUES (${insertedId}, ${schoolId}, ${periodType}::"FeePeriodType", ${year}, ${normalizedMonth}, ${normalizedSemester}, ${amountDue}, ${userId}, NOW(), NOW())
            RETURNING id, school_id, period_type, year, month, semester, amount_due, created_by, created_at, updated_at
          `
          schedule = normalizeScheduleRow(insertedRows[0])
        }
      }

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

      const { scheduleId, studentId, amountPaid, paymentMethod, paymentDate, notes } = validation.data

      const delegates = getPrismaDelegates()
      const [schedule, student] = await Promise.all([
        delegates.feeSchedule?.findUnique
          ? prisma.feeSchedule.findUnique({ where: { id: scheduleId } })
          : (async () => {
              const rows = await prisma.$queryRaw<FeeScheduleRow[]>`
                SELECT id, school_id, period_type, year, month, semester, amount_due, created_by, created_at, updated_at
                FROM fee_schedules
                WHERE id = ${scheduleId}
                LIMIT 1
              `
              return rows[0] ? normalizeScheduleRow(rows[0]) : null
            })(),
        prisma.student.findUnique({ where: { id: studentId } }),
      ])

      if (!schedule || schedule.schoolId !== schoolId) {
        return NextResponse.json({ error: 'Fee schedule not found' }, { status: 404 })
      }

      if (!student || student.schoolId !== schoolId) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }

      const currentTerm = await getCurrentEditableTermForSchool(schoolId)

      const paymentPayload = {
        schoolId,
        scheduleId,
        studentId,
        term_id: currentTerm.id,
        paymentMethod,
        paymentNumber: createPaymentNumber(),
        amountPaid,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        notes: notes || null,
        receivedBy: userId,
      }

      const payment = delegates.feePayment?.create
        ? await prisma.feePayment.create({
            data: paymentPayload,
          })
        : await (async () => {
            const insertedId = crypto.randomUUID()
            const rows = await prisma.$queryRaw<FeePaymentRow[]>`
              INSERT INTO fee_payments (id, school_id, schedule_id, student_id, term_id, payment_method, payment_number, amount_paid, payment_date, notes, received_by, created_at)
              VALUES (
                ${insertedId},
                ${paymentPayload.schoolId},
                ${paymentPayload.scheduleId},
                ${paymentPayload.studentId},
                ${paymentPayload.term_id},
                ${paymentPayload.paymentMethod}::"PaymentMethod",
                ${paymentPayload.paymentNumber},
                ${paymentPayload.amountPaid},
                ${paymentPayload.paymentDate},
                ${paymentPayload.notes},
                ${paymentPayload.receivedBy},
                NOW()
              )
              RETURNING id, school_id, schedule_id, student_id, payment_method, payment_number, amount_paid, payment_date
            `

            const inserted = normalizePaymentRow(rows[0])
            return {
              id: inserted.id,
              schoolId: inserted.schoolId,
              scheduleId: inserted.scheduleId,
              studentId: inserted.studentId,
              paymentMethod: inserted.paymentMethod,
              paymentNumber: inserted.paymentNumber,
              amountPaid: inserted.amountPaid,
              paymentDate: inserted.paymentDate,
            }
          })()

      return NextResponse.json({ payment }, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error handling fees:', error)
    if (error instanceof CurrentTermNotSetError || error instanceof TermLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
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
