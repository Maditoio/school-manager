import { prisma } from '@/lib/prisma'
import { getStudentLicenseCoverageSnapshot } from '@/lib/student-licenses'

export async function getSchoolLicenseStatus(schoolId: string) {
  const snapshot = await getStudentLicenseCoverageSnapshot(schoolId)

  return {
    configured: snapshot.configured,
    onboardingFee: snapshot.onboardingFee,
    onboardingStatus: snapshot.onboardingStatus,
    annualPricePerStudent: snapshot.annualPricePerStudent,
    licensedStudentCount: snapshot.licensedStudentCount,
    activeStudents: snapshot.activeStudents,
    coveredStudents: snapshot.coveredStudents,
    uncoveredStudents: snapshot.uncoveredStudents,
    coverageCapacity: snapshot.licensedStudentCount,
    uncoveredCapacity: Math.max(snapshot.activeStudents - snapshot.licensedStudentCount, 0),
    studentsWithAccess: snapshot.studentsWithAccess,
    studentsWithoutAccess: snapshot.studentsWithoutAccess,
    requiredAmountPerStudent: snapshot.requiredAmountPerStudent,
    bulkCoveredStudents: snapshot.bulkCoveredStudents,
    extraCoveredStudents: snapshot.extraCoveredStudents,
    studentsNeedingExtraLicensePayment: snapshot.studentsNeedingExtraLicensePayment,
    extraLicenseCost: snapshot.extraLicenseCost,
    licenseYear: snapshot.licenseYear,
    billingYear: snapshot.billingYear,
    licenseStartDate: snapshot.licenseStartDate,
    licenseEndDate: snapshot.licenseEndDate,
    enabledModules: snapshot.enabledModules,
    notes: snapshot.notes,
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

  const licenseSnapshot = await getStudentLicenseCoverageSnapshot(student.schoolId)
  const totalPaid = Number((licenseSnapshot.paymentTotalsByStudentId.get(studentId) ?? 0).toFixed(2))
  const hasAccess = licenseSnapshot.licenseByStudentId.has(studentId)
  const outstandingBalance = hasAccess
    ? 0
    : Number(licenseSnapshot.requiredAmountPerStudent.toFixed(2))
  const unpaidScheduleCount = hasAccess ? 0 : 1

  const blocked = !hasAccess
  const studentName = `${student.firstName} ${student.lastName}`.trim()

  return {
    allowed: !blocked,
    blocked,
    reason: blocked
      ? `Portal access is blocked because no active student license is assigned for ${licenseSnapshot.licenseYear}. Amount required to cover this student: ${outstandingBalance.toFixed(2)}.`
      : null,
    outstandingBalance,
    unpaidScheduleCount,
    studentName,
    licenseYear: licenseSnapshot.licenseYear,
    requiredAmount: licenseSnapshot.requiredAmountPerStudent,
    totalPaid,
    coverageSource: licenseSnapshot.licenseByStudentId.get(studentId)?.source ?? null,
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
      ? `Portal access is blocked because ${unpaidStudents[0].studentName} is not covered by the current student license.`
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
