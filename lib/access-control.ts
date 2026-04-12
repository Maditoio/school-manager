import { prisma } from '@/lib/prisma'

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
    prisma.student.findMany({
      where: { schoolId, status: 'ACTIVE' },
      select: { id: true },
    }),
  ])

  const activeStudentCount = activeStudents.length
  const licenseYear = billing?.billingYear && billing.billingYear > 0 ? billing.billingYear : new Date().getFullYear()
  const requiredAmountPerStudent = Number(billing?.annualPricePerStudent ?? 0)

  const licensedStudentCount = billing && isLicenseActive(billing.licenseStartDate, billing.licenseEndDate)
    ? billing.licensedStudentCount
    : 0

  const coverageCapacity = Math.min(activeStudentCount, licensedStudentCount)
  const uncoveredCapacity = Math.max(activeStudentCount - licensedStudentCount, 0)

  const activeStudentIds = activeStudents.map((student) => student.id)
  const payments = activeStudentIds.length
    ? await prisma.studentLicensePayment.findMany({
        where: {
          schoolId,
          licenseYear,
          studentId: { in: activeStudentIds },
        },
        select: {
          studentId: true,
          amountPaid: true,
        },
      })
    : []

  const paidByStudent = new Map<string, number>()
  for (const payment of payments) {
    paidByStudent.set(payment.studentId, (paidByStudent.get(payment.studentId) ?? 0) + Number(payment.amountPaid))
  }

  const hasAccess = (paidAmount: number) =>
    requiredAmountPerStudent > 0 ? paidAmount >= requiredAmountPerStudent : paidAmount > 0

  const studentsWithAccess = activeStudentIds.reduce((count, studentId) => {
    const paidAmount = paidByStudent.get(studentId) ?? 0
    return hasAccess(paidAmount) ? count + 1 : count
  }, 0)
  const studentsWithoutAccess = Math.max(activeStudentCount - studentsWithAccess, 0)

  return {
    configured: Boolean(billing),
    onboardingFee: billing?.onboardingFee ?? 0,
    onboardingStatus: billing?.onboardingStatus ?? 'PENDING',
    annualPricePerStudent: billing?.annualPricePerStudent ?? 0,
    licensedStudentCount,
    activeStudents: activeStudentCount,
    coveredStudents: studentsWithAccess,
    uncoveredStudents: studentsWithoutAccess,
    coverageCapacity,
    uncoveredCapacity,
    studentsWithAccess,
    studentsWithoutAccess,
    requiredAmountPerStudent,
    licenseYear,
    billingYear: billing?.billingYear ?? 0,
    licenseStartDate: billing?.licenseStartDate ?? null,
    licenseEndDate: billing?.licenseEndDate ?? null,
    enabledModules: billing?.enabledModules ?? [],
    notes: billing?.notes ?? null,
  }
}

export async function getStudentFeeAccessStatus(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      schoolId: true,
      status: true,
      firstName: true,
      lastName: true,
    },
  })

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

  const billing = await prisma.schoolBilling.findUnique({
    where: { schoolId: student.schoolId },
    select: {
      annualPricePerStudent: true,
      billingYear: true,
    },
  })

  const licenseYear = billing?.billingYear && billing.billingYear > 0 ? billing.billingYear : new Date().getFullYear()
  const requiredAmount = Number(billing?.annualPricePerStudent ?? 0)

  const payments = await prisma.studentLicensePayment.findMany({
    where: {
      studentId,
      schoolId: student.schoolId,
      licenseYear,
    },
    select: {
      amountPaid: true,
    },
  })

  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amountPaid), 0)
  const outstandingBalance = requiredAmount > 0
    ? Number(Math.max(requiredAmount - totalPaid, 0).toFixed(2))
    : 0
  const hasAccess = requiredAmount > 0 ? totalPaid >= requiredAmount : totalPaid > 0
  const unpaidScheduleCount = hasAccess ? 0 : 1

  const blocked = !hasAccess
  const studentName = `${student.firstName} ${student.lastName}`.trim()

  return {
    allowed: !blocked,
    blocked,
    reason: blocked
      ? `Portal access is blocked until the student license payment is completed for ${licenseYear}. Remaining amount: ${outstandingBalance.toFixed(2)}.`
      : null,
    outstandingBalance,
    unpaidScheduleCount,
    studentName,
    licenseYear,
    requiredAmount,
    totalPaid: Number(totalPaid.toFixed(2)),
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
      ? `Portal access is blocked because ${unpaidStudents[0].studentName} has not completed the student license payment.`
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
