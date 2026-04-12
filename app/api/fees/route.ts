import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getSchoolLicenseStatus } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { createFeeScheduleSchema, recordFeePaymentSchema } from '@/lib/validations'
import { CurrentTermNotSetError, getCurrentEditableTermForSchool, TermLockedError } from '@/lib/term-utils'

type FeeScheduleStatus = 'PENDING_APPROVAL' | 'APPROVED'

type FeeScheduleRow = {
  id: string
  school_id: string
  class_id: string | null
  period_type: 'MONTHLY' | 'SEMESTER' | 'YEARLY'
  year: number
  month: number | null
  semester: number | null
  amount_due: number
  status: FeeScheduleStatus
  approved_by: string | null
  approved_at: Date | null
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
  receipt_url: string | null
  receipt_file_name: string | null
  receipt_mime_type: string | null
}

type ScheduleNormalized = {
  id: string
  schoolId: string
  classId: string | null
  periodType: 'MONTHLY' | 'SEMESTER' | 'YEARLY'
  year: number
  month: number | null
  semester: number | null
  amountDue: number
  status: FeeScheduleStatus
  approvedBy: string | null
  approvedAt: Date | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  className: string | null
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
  }
  return prismaUnsafe
}

function normalizeScheduleRow(row: FeeScheduleRow, className: string | null = null): ScheduleNormalized {
  return {
    id: row.id,
    schoolId: row.school_id,
    classId: row.class_id,
    periodType: row.period_type,
    year: Number(row.year),
    month: row.month === null ? null : Number(row.month),
    semester: row.semester === null ? null : Number(row.semester),
    amountDue: Number(row.amount_due),
    status: row.status as FeeScheduleStatus,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    className,
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
    receiptUrl: row.receipt_url,
    receiptFileName: row.receipt_file_name,
    receiptMimeType: row.receipt_mime_type,
  }
}

function buildPeriodKey(
  periodType: string,
  year: number,
  month: number | null,
  semester: number | null
) {
  return `${periodType}:${year}:${month ?? ''}:${semester ?? ''}`
}

function buildPeriodLabel(
  periodType: 'MONTHLY' | 'SEMESTER' | 'YEARLY',
  year: number,
  month: number | null,
  semester: number | null
) {
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
    return { userId: sessionUser.id as string, schoolId: sessionUser.schoolId as string }
  }

  if (!fallbackEmail) return null

  const user = await prisma.user.findUnique({
    where: { email: fallbackEmail.toLowerCase() },
    select: { id: true, schoolId: true, role: true },
  })

  if (!user || !['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE', 'FINANCE_MANAGER'].includes(user.role) || !user.schoolId) return null

  return { userId: user.id, schoolId: user.schoolId }
}

async function getAllSchedulesForSchool(schoolId: string): Promise<ScheduleNormalized[]> {
  const delegates = getPrismaDelegates()

  if (delegates.feeSchedule?.findMany) {
    const raw = await prisma.feeSchedule.findMany({
      where: { schoolId },
      include: { scheduledClass: { select: { name: true } } },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    })

    return raw.map((s) => ({
      id: s.id,
      schoolId: s.schoolId,
      classId: s.classId,
      periodType: s.periodType as 'MONTHLY' | 'SEMESTER' | 'YEARLY',
      year: s.year,
      month: s.month,
      semester: s.semester,
      amountDue: Number(s.amountDue),
      status: s.status as FeeScheduleStatus,
      approvedBy: s.approvedBy,
      approvedAt: s.approvedAt,
      createdBy: s.createdBy,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      className: (s as typeof s & { scheduledClass?: { name: string } | null }).scheduledClass?.name ?? null,
    }))
  }

  const rows = await prisma.$queryRaw<(FeeScheduleRow & { class_name: string | null })[]>`
    SELECT fs.id, fs.school_id, fs.class_id, fs.period_type, fs.year, fs.month, fs.semester,
           fs.amount_due, fs.status, fs.approved_by, fs.approved_at, fs.created_by, fs.created_at, fs.updated_at,
           c.name AS class_name
    FROM fee_schedules fs
    LEFT JOIN classes c ON c.id = fs.class_id
    WHERE fs.school_id = ${schoolId}
    ORDER BY fs.year DESC, fs.created_at DESC
  `

  return rows.map((r) => normalizeScheduleRow(r, r.class_name))
}

// GET /api/fees
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE', 'FINANCE_MANAGER'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userContext = await resolveFeesUserContext(session.user)
    if (!userContext?.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const { schoolId } = userContext
    const { searchParams } = new URL(request.url)
    const periodKey = searchParams.get('periodKey')

    const [allSchedules, licenseSummary] = await Promise.all([
      getAllSchedulesForSchool(schoolId),
      getSchoolLicenseStatus(schoolId),
    ])

    // Pending schedules visible to all finance/admin roles
    const pendingSchedules = allSchedules
      .filter((s) => s.status === 'PENDING_APPROVAL')
      .map((s) => ({
        id: s.id,
        periodType: s.periodType,
        year: s.year,
        month: s.month,
        semester: s.semester,
        classId: s.classId,
        className: s.className,
        amountDue: s.amountDue,
        createdAt: s.createdAt,
        periodLabel: buildPeriodLabel(s.periodType, s.year, s.month, s.semester),
        label: s.classId
          ? `${buildPeriodLabel(s.periodType, s.year, s.month, s.semester)} · ${s.className || 'Unknown Class'}`
          : `${buildPeriodLabel(s.periodType, s.year, s.month, s.semester)} · All Classes`,
      }))

    // Only APPROVED schedules are used for payment calculations
    const approvedSchedules = allSchedules.filter((s) => s.status === 'APPROVED')

    // Build distinct periods from APPROVED schedules
    const periodMap = new Map<
      string,
      {
        key: string
        periodType: 'MONTHLY' | 'SEMESTER' | 'YEARLY'
        year: number
        month: number | null
        semester: number | null
        label: string
        hasClassSpecific: boolean
      }
    >()

    for (const s of approvedSchedules) {
      const key = buildPeriodKey(s.periodType, s.year, s.month, s.semester)
      const existing = periodMap.get(key)
      if (!existing) {
        periodMap.set(key, {
          key,
          periodType: s.periodType,
          year: s.year,
          month: s.month,
          semester: s.semester,
          label: buildPeriodLabel(s.periodType, s.year, s.month, s.semester),
          hasClassSpecific: s.classId !== null,
        })
      } else if (s.classId !== null) {
        existing.hasClassSpecific = true
      }
    }

    const periods = Array.from(periodMap.values())

    if (periods.length === 0) {
      return NextResponse.json({
        periods: [],
        selectedPeriod: null,
        pendingSchedules,
        licenseSummary,
        summary: { studentsCount: 0, payingCount: 0, notPayingCount: 0, collectedAmount: 0, pendingAmount: 0 },
        studentStatuses: [],
        recentPayments: [],
      })
    }

    // Select period
    const selectedPeriodData = (periodKey ? periodMap.get(periodKey) : null) ?? periods[0]

    // All APPROVED schedules for the selected period
    const periodSchedules = approvedSchedules.filter(
      (s) => buildPeriodKey(s.periodType, s.year, s.month, s.semester) === selectedPeriodData.key
    )
    const periodScheduleIds = periodSchedules.map((s) => s.id)

    // Fetch students for this period's year
    const students = await prisma.student.findMany({
      where: { schoolId, academicYear: selectedPeriodData.year },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true, classId: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })

    // Fetch class names
    const classIdsInUse = Array.from(
      new Set(students.map((s) => s.classId).filter((id): id is string => id !== null))
    )
    const classes = classIdsInUse.length
      ? await prisma.class.findMany({
          where: { id: { in: classIdsInUse }, schoolId },
          select: { id: true, name: true },
        })
      : []
    const classNameById = new Map(classes.map((c) => [c.id, c.name]))

    // Fetch payments for all schedules in this period
    const delegates = getPrismaDelegates()
    let periodPayments: Array<{
      id: string
      studentId: string
      scheduleId: string
      paymentMethod: string
      paymentNumber: string
      amountPaid: number
      paymentDate: Date
      receiptUrl: string | null
      receiptFileName: string | null
      receiptMimeType: string | null
    }> = []

    if (periodScheduleIds.length > 0) {
      if (delegates.feePayment?.findMany) {
        const raw = await prisma.feePayment.findMany({
          where: { schoolId, scheduleId: { in: periodScheduleIds } },
          select: {
            id: true,
            studentId: true,
            scheduleId: true,
            paymentMethod: true,
            paymentNumber: true,
            amountPaid: true,
            paymentDate: true,
            receiptUrl: true,
            receiptFileName: true,
            receiptMimeType: true,
          },
          orderBy: { paymentDate: 'desc' },
        })
        periodPayments = raw.map((p) => ({
          id: p.id,
          studentId: p.studentId,
          scheduleId: p.scheduleId,
          paymentMethod: p.paymentMethod,
          paymentNumber: p.paymentNumber,
          amountPaid: Number(p.amountPaid),
          paymentDate: p.paymentDate,
            receiptUrl: p.receiptUrl,
            receiptFileName: p.receiptFileName,
            receiptMimeType: p.receiptMimeType,
        }))
      } else {
        const rows = await prisma.$queryRaw<FeePaymentRow[]>`
          SELECT id, school_id, schedule_id, student_id, payment_method, payment_number, amount_paid, payment_date,
                 receipt_url, receipt_file_name, receipt_mime_type
          FROM fee_payments
          WHERE school_id = ${schoolId}
            AND schedule_id = ANY(${periodScheduleIds}::uuid[])
          ORDER BY payment_date DESC
        `
        periodPayments = rows.map((row) => {
          const p = normalizePaymentRow(row)
          return {
            id: p.id,
            studentId: p.studentId,
            scheduleId: p.scheduleId,
            paymentMethod: p.paymentMethod,
            paymentNumber: p.paymentNumber,
            amountPaid: p.amountPaid,
            paymentDate: p.paymentDate,
            receiptUrl: p.receiptUrl,
            receiptFileName: p.receiptFileName,
            receiptMimeType: p.receiptMimeType,
          }
        })
      }
    }

    // Build per-student paid totals
    const paidByStudent = new Map<string, { totalPaid: number; lastPaymentDate: Date | null }>()
    for (const payment of periodPayments) {
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

    // Schedule lookup maps for per-student fee resolution
    const schoolWideSchedule = periodSchedules.find((s) => s.classId === null) ?? null
    const classScheduleMap = new Map(
      periodSchedules.filter((s) => s.classId !== null).map((s) => [s.classId!, s])
    )

    // Per-student fee resolution: class-specific first, then school-wide fallback
    const studentStatuses = students.map((student) => {
      const classSchedule = student.classId ? (classScheduleMap.get(student.classId) ?? null) : null
      const applicableSchedule = classSchedule ?? schoolWideSchedule

      const amountDue = applicableSchedule?.amountDue ?? 0
      const scheduleId = applicableSchedule?.id ?? null
      const studentPayments = paidByStudent.get(student.id)
      const totalPaid = studentPayments?.totalPaid ?? 0
      const balance = Number((amountDue - totalPaid).toFixed(2))
      const status =
        amountDue === 0
          ? 'NO_SCHEDULE'
          : balance <= 0
          ? 'PAID'
          : totalPaid > 0
          ? 'PARTIAL'
          : 'NOT_PAID'

      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        className: classNameById.get(student.classId!) ?? '-',
        classId: student.classId,
        scheduleId,
        amountDue,
        totalPaid,
        balance,
        status,
        lastPaymentDate: studentPayments?.lastPaymentDate ?? null,
      }
    })

    const studentsWithSchedule = studentStatuses.filter((s) => s.status !== 'NO_SCHEDULE')
    const studentsCount = studentsWithSchedule.length
    const payingCount = studentsWithSchedule.filter((s) => s.status === 'PAID').length
    const collectedAmount = Number(
      periodPayments.reduce((sum, p) => sum + p.amountPaid, 0).toFixed(2)
    )
    const expectedAmount = Number(
      studentsWithSchedule.reduce((sum, s) => sum + s.amountDue, 0).toFixed(2)
    )
    const pendingAmount = Number(Math.max(expectedAmount - collectedAmount, 0).toFixed(2))

    // Recent payments with student details
    const paymentStudentIds = Array.from(new Set(periodPayments.map((p) => p.studentId)))
    const paymentStudents = paymentStudentIds.length
      ? await prisma.student.findMany({
          where: { schoolId, id: { in: paymentStudentIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            classId: true,
          },
        })
      : []
    const paymentStudentById = new Map(paymentStudents.map((s) => [s.id, s]))

    const recentPayments = periodPayments.slice(0, 30).map((payment) => {
      const student = paymentStudentById.get(payment.studentId)
      return {
        id: payment.id,
        paymentMethod: payment.paymentMethod,
        paymentNumber: payment.paymentNumber,
        amountPaid: payment.amountPaid,
        paymentDate: payment.paymentDate,
        receiptUrl: payment.receiptUrl,
        receiptFileName: payment.receiptFileName,
        receiptMimeType: payment.receiptMimeType,
        studentName: student
          ? `${student.firstName} ${student.lastName}`
          : 'Unknown Student',
        admissionNumber: student?.admissionNumber ?? null,
        className: student ? (classNameById.get(student.classId!) ?? '-') : '-',
      }
    })

    return NextResponse.json({
      periods,
      selectedPeriod: selectedPeriodData,
      pendingSchedules,
      licenseSummary,
      summary: {
        studentsCount: studentStatuses.length,
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

// POST /api/fees
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE', 'FINANCE_MANAGER'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userContext = await resolveFeesUserContext(session.user)
    if (!userContext?.schoolId || !userContext.userId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const { schoolId, userId } = userContext
    const role = session.user.role
    const body = await request.json()
    const action = body?.action

    // createSchedule — only SCHOOL_ADMIN and FINANCE_MANAGER may create fee schedules
    if (action === 'createSchedule') {
      if (!hasRole(role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE_MANAGER'])) {
        return NextResponse.json({ error: 'Only Finance Managers can create fee schedules' }, { status: 403 })
      }
      const validation = createFeeScheduleSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.issues.map((i) => i.message).join(', ') },
          { status: 400 }
        )
      }

      const { periodType, year, month, semester, amountDue, classId } = validation.data

      if (periodType === 'MONTHLY' && !month) {
        return NextResponse.json({ error: 'Month is required for monthly schedule' }, { status: 400 })
      }
      if (periodType === 'SEMESTER' && !semester) {
        return NextResponse.json({ error: 'Semester is required for semester schedule' }, { status: 400 })
      }
      if (periodType === 'YEARLY' && (month || semester)) {
        return NextResponse.json(
          { error: 'Yearly schedule should not include month or semester' },
          { status: 400 }
        )
      }

      if (classId) {
        const classRecord = await prisma.class.findUnique({
          where: { id: classId },
          select: { schoolId: true },
        })
        if (!classRecord || classRecord.schoolId !== schoolId) {
          return NextResponse.json({ error: 'Class not found' }, { status: 404 })
        }
      }

      const normalizedMonth = periodType === 'MONTHLY' ? (month ?? null) : null
      const normalizedSemester = periodType === 'SEMESTER' ? (semester ?? null) : null
      const normalizedClassId = classId ?? null

      // SCHOOL_ADMIN and DEPUTY_ADMIN auto-approve; FINANCE / FINANCE_MANAGER create as pending
      const status: FeeScheduleStatus =
        (role === 'SCHOOL_ADMIN' || role === 'DEPUTY_ADMIN') ? 'APPROVED' : 'PENDING_APPROVAL'
      const approvedBy = (role === 'SCHOOL_ADMIN' || role === 'DEPUTY_ADMIN') ? userId : null
      const approvedAt = (role === 'SCHOOL_ADMIN' || role === 'DEPUTY_ADMIN') ? new Date() : null

      const delegates = getPrismaDelegates()

      let schedule: {
        id: string
        schoolId: string
        classId: string | null
        periodType: string
        year: number
        month: number | null
        semester: number | null
        amountDue: number
        status: string
      }

      try {
        if (delegates.feeSchedule?.create) {
          schedule = await prisma.feeSchedule.create({
            data: {
              schoolId,
              classId: normalizedClassId,
              periodType,
              year,
              month: normalizedMonth,
              semester: normalizedSemester,
              amountDue,
              status,
              approvedBy,
              approvedAt,
              createdBy: userId,
            },
          })
        } else {
          const insertedId = crypto.randomUUID()
          const rows = await prisma.$queryRaw<FeeScheduleRow[]>`
            INSERT INTO fee_schedules (id, school_id, class_id, period_type, year, month, semester, amount_due, status, approved_by, approved_at, created_by, created_at, updated_at)
            VALUES (
              ${insertedId}, ${schoolId},
              ${normalizedClassId}::uuid,
              ${periodType}::"FeePeriodType", ${year}, ${normalizedMonth}, ${normalizedSemester},
              ${amountDue}, ${status}::"FeeScheduleStatus",
              ${approvedBy}::uuid, ${approvedAt},
              ${userId}, NOW(), NOW()
            )
            RETURNING id, school_id, class_id, period_type, year, month, semester, amount_due, status, approved_by, approved_at, created_by, created_at, updated_at
          `
          schedule = normalizeScheduleRow(rows[0])
        }
      } catch (err) {
        const prismaErr = err as { code?: string }
        if (prismaErr.code === 'P2002') {
          return NextResponse.json(
            { error: 'A fee schedule for this period and class already exists.' },
            { status: 409 }
          )
        }
        const pgErr = err as { message?: string }
        if (pgErr.message?.includes('unique constraint') || pgErr.message?.includes('duplicate key')) {
          return NextResponse.json(
            { error: 'A fee schedule for this period and class already exists.' },
            { status: 409 }
          )
        }
        throw err
      }

      return NextResponse.json({ schedule }, { status: 201 })
    }

    // recordPayment — only SCHOOL_ADMIN and FINANCE may record payments
    if (action === 'recordPayment') {
      if (!hasRole(role, ['SCHOOL_ADMIN', 'FINANCE'])) {
        return NextResponse.json({ error: 'Only Finance staff can record payments' }, { status: 403 })
      }
      const validation = recordFeePaymentSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.issues.map((i) => i.message).join(', ') },
          { status: 400 }
        )
      }

      const {
        scheduleId,
        studentId,
        amountPaid,
        paymentMethod,
        paymentDate,
        notes,
        receiptUrl,
        receiptFileName,
        receiptMimeType,
      } = validation.data

      const delegates = getPrismaDelegates()
      const [scheduleRaw, student] = await Promise.all([
        delegates.feeSchedule?.findUnique
          ? prisma.feeSchedule.findUnique({ where: { id: scheduleId } })
          : (async () => {
              const rows = await prisma.$queryRaw<FeeScheduleRow[]>`
                SELECT id, school_id, class_id, period_type, year, month, semester, amount_due,
                       status, approved_by, approved_at, created_by, created_at, updated_at
                FROM fee_schedules WHERE id = ${scheduleId} LIMIT 1
              `
              return rows[0] ? normalizeScheduleRow(rows[0]) : null
            })(),
        prisma.student.findUnique({ where: { id: studentId } }),
      ])

      if (!scheduleRaw || scheduleRaw.schoolId !== schoolId) {
        return NextResponse.json({ error: 'Fee schedule not found' }, { status: 404 })
      }
      if (scheduleRaw.status !== 'APPROVED') {
        return NextResponse.json(
          { error: 'Cannot record payment against a pending fee schedule. The schedule must be approved first.' },
          { status: 409 }
        )
      }
      if (!student || student.schoolId !== schoolId) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }

      const currentTerm = await getCurrentEditableTermForSchool(schoolId)

      const paymentPayload = {
        schoolId,
        scheduleId,
        studentId,
        termId: currentTerm.id,
        paymentMethod,
        paymentNumber: createPaymentNumber(),
        amountPaid,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        notes: notes || null,
        receiptUrl: receiptUrl || null,
        receiptFileName: receiptFileName || null,
        receiptMimeType: receiptMimeType || null,
        receivedBy: userId,
      }

      const payment = delegates.feePayment?.create
        ? await prisma.feePayment.create({ data: paymentPayload })
        : await (async () => {
            const insertedId = crypto.randomUUID()
            const rows = await prisma.$queryRaw<FeePaymentRow[]>`
              INSERT INTO fee_payments (
                id, school_id, schedule_id, student_id, term_id,
                payment_method, payment_number, amount_paid, payment_date,
                notes, receipt_url, receipt_file_name, receipt_mime_type,
                received_by, created_at
              )
              VALUES (
                ${insertedId}, ${paymentPayload.schoolId}, ${paymentPayload.scheduleId},
                ${paymentPayload.studentId}, ${paymentPayload.termId},
                ${paymentPayload.paymentMethod}::"PaymentMethod",
                ${paymentPayload.paymentNumber}, ${paymentPayload.amountPaid},
                ${paymentPayload.paymentDate}, ${paymentPayload.notes},
                ${paymentPayload.receiptUrl}, ${paymentPayload.receiptFileName}, ${paymentPayload.receiptMimeType},
                ${paymentPayload.receivedBy}, NOW()
              )
              RETURNING id, school_id, schedule_id, student_id, payment_method, payment_number, amount_paid, payment_date,
                        receipt_url, receipt_file_name, receipt_mime_type
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
              receiptUrl: inserted.receiptUrl,
              receiptFileName: inserted.receiptFileName,
              receiptMimeType: inserted.receiptMimeType,
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
