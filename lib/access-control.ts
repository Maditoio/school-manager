import { prisma } from '@/lib/prisma'

type ApplicableSchedule = {
  id: string
  amountDue: number
}

function buildPeriodKey(periodType: string, year: number, month: number | null, semester: number | null) {
  return `${periodType}:${year}:${month ?? ''}:${semester ?? ''}`
}

function toDateOnly(value: Date | null | undefined) {
  if (!value) return null
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function isLicenseActive(startDate: Date | null, endDate: Date | null) {
  const today = toDateOnly(new Date())
  const start = toDateOnly(startDate)
  const end = toDateOnly(endDate)

  if (!today) return false
  if (start && today < start) return false
  if (end && today > end) return false
  return true
}

export async function getSchoolLicenseStatus(schoolId: string) {
  const [billing, activeStudents] = await Promise.all([
    prisma.schoolBilling.findUnique({ where: { schoolId } }),
    prisma.student.count({ where: { schoolId, status: 'ACTIVE' } }),
  ])

  const licensedStudentCount = billing && isLicenseActive(billing.licenseStartDate, billing.licenseEndDate)
    ? billing.licensedStudentCount
    : 0

  const coveredStudents = Math.min(activeStudents, licensedStudentCount)
  const uncoveredStudents = Math.max(activeStudents - licensedStudentCount, 0)

  return {
    configured: Boolean(billing),
    onboardingFee: billing?.onboardingFee ?? 0,
    onboardingStatus: billing?.onboardingStatus ?? 'PENDING',
    annualPricePerStudent: billing?.annualPricePerStudent ?? 0,
    licensedStudentCount,
    activeStudents,
    coveredStudents,
    uncoveredStudents,
    billingYear: billing?.billingYear ?? 0,
    licenseStartDate: billing?.licenseStartDate ?? null,
    licenseEndDate: billing?.licenseEndDate ?? null,
    enabledModules: billing?.enabledModules ?? [],
    notes: billing?.notes ?? null,
  }
}

async function getApplicableSchedulesForStudent(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      schoolId: true,
      classId: true,
      academicYear: true,
      status: true,
      firstName: true,
      lastName: true,
    },
  })

  if (!student) {
    return { student: null, applicableSchedules: [] as ApplicableSchedule[] }
  }

  const schedules = await prisma.feeSchedule.findMany({
    where: {
      schoolId: student.schoolId,
      year: student.academicYear,
      status: 'APPROVED',
      OR: [{ classId: student.classId }, { classId: null }],
    },
    select: {
      id: true,
      classId: true,
      periodType: true,
      year: true,
      month: true,
      semester: true,
      amountDue: true,
    },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
  })

  const scheduleByPeriod = new Map<string, ApplicableSchedule>()

  for (const schedule of schedules) {
    const key = buildPeriodKey(schedule.periodType, schedule.year, schedule.month, schedule.semester)
    const existing = scheduleByPeriod.get(key)
    const candidate = {
      id: schedule.id,
      amountDue: Number(schedule.amountDue),
    }

    if (!existing) {
      scheduleByPeriod.set(key, candidate)
      continue
    }

    if (schedule.classId && schedule.classId === student.classId) {
      scheduleByPeriod.set(key, candidate)
    }
  }

  return { student, applicableSchedules: Array.from(scheduleByPeriod.values()) }
}

export async function getStudentFeeAccessStatus(studentId: string) {
  const { student, applicableSchedules } = await getApplicableSchedulesForStudent(studentId)

  if (!student) {
    return {
      allowed: false,
      blocked: true,
      reason: 'Student account could not be resolved.',
      outstandingBalance: 0,
      unpaidScheduleCount: 0,
      studentName: 'Unknown Student',
    }
  }

  if (student.status !== 'ACTIVE') {
    return {
      allowed: true,
      blocked: false,
      reason: null,
      outstandingBalance: 0,
      unpaidScheduleCount: 0,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
    }
  }

  if (applicableSchedules.length === 0) {
    return {
      allowed: true,
      blocked: false,
      reason: null,
      outstandingBalance: 0,
      unpaidScheduleCount: 0,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
    }
  }

  const payments = await prisma.feePayment.findMany({
    where: {
      studentId,
      scheduleId: { in: applicableSchedules.map((schedule) => schedule.id) },
    },
    select: {
      scheduleId: true,
      amountPaid: true,
    },
  })

  const paidBySchedule = new Map<string, number>()
  for (const payment of payments) {
    paidBySchedule.set(payment.scheduleId, (paidBySchedule.get(payment.scheduleId) ?? 0) + Number(payment.amountPaid))
  }

  let outstandingBalance = 0
  let unpaidScheduleCount = 0
  for (const schedule of applicableSchedules) {
    const balance = Math.max(schedule.amountDue - (paidBySchedule.get(schedule.id) ?? 0), 0)
    if (balance > 0) {
      outstandingBalance += balance
      unpaidScheduleCount += 1
    }
  }

  const blocked = outstandingBalance > 0
  const studentName = `${student.firstName} ${student.lastName}`.trim()

  return {
    allowed: !blocked,
    blocked,
    reason: blocked
      ? `Outstanding school fees of ${outstandingBalance.toFixed(2)} must be cleared before portal access is restored.`
      : null,
    outstandingBalance: Number(outstandingBalance.toFixed(2)),
    unpaidScheduleCount,
    studentName,
  }
}

export async function getParentFeeAccessStatus(parentUserId: string) {
  const children = await prisma.student.findMany({
    where: {
      parentId: parentUserId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })

  if (children.length === 0) {
    return {
      allowed: true,
      blocked: false,
      reason: null,
      unpaidStudents: [] as Array<{ studentId: string; studentName: string; outstandingBalance: number }>,
    }
  }

  const results = await Promise.all(
    children.map(async (child) => ({
      child,
      access: await getStudentFeeAccessStatus(child.id),
    }))
  )
  const unpaidStudents = results
    .filter((result) => result.access.blocked)
    .map((result) => ({
      studentId: result.child.id,
      studentName: result.access.studentName,
      outstandingBalance: result.access.outstandingBalance,
    }))

  const blocked = unpaidStudents.length > 0

  return {
    allowed: !blocked,
    blocked,
    reason: blocked
      ? `Portal access is blocked because ${unpaidStudents[0].studentName} has outstanding school fees.`
      : null,
    unpaidStudents,
  }
}

export async function getPortalAccessState(params: {
  role: string | null | undefined
  studentId?: string | null
  userId: string
}) {
  if (params.role === 'STUDENT' && params.studentId) {
    const result = await getStudentFeeAccessStatus(params.studentId)
    return {
      blocked: result.blocked,
      reason: result.reason,
    }
  }

  if (params.role === 'PARENT') {
    const result = await getParentFeeAccessStatus(params.userId)
    return {
      blocked: result.blocked,
      reason: result.reason,
    }
  }

  return {
    blocked: false,
    reason: null,
  }
}
