import { prisma } from '@/lib/prisma'

export type StudentLicenseCoverageSource = 'BULK' | 'EXTRA_PAYMENT'

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

export function resolveLicenseYear(billingYear: number | null | undefined) {
  return billingYear && billingYear > 0 ? billingYear : new Date().getFullYear()
}

export async function getStudentLicenseCoverageSnapshot(schoolId: string) {
  const [billing, activeStudents] = await Promise.all([
    prisma.schoolBilling.findUnique({
      where: { schoolId },
      select: {
        onboardingFee: true,
        onboardingStatus: true,
        annualPricePerStudent: true,
        licensedStudentCount: true,
        billingYear: true,
        licenseStartDate: true,
        licenseEndDate: true,
        enabledModules: true,
        notes: true,
      },
    }),
    prisma.student.findMany({
      where: { schoolId, status: 'ACTIVE' },
      select: { id: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ])

  const licenseYear = resolveLicenseYear(billing?.billingYear)
  const requiredAmountPerStudent = Number(billing?.annualPricePerStudent ?? 0)
  const bulkLicensedStudentCount = billing && isLicenseActive(billing.licenseStartDate, billing.licenseEndDate)
    ? Math.max(Number(billing.licensedStudentCount ?? 0), 0)
    : 0

  let existingLicenses = await prisma.studentLicense.findMany({
    where: { schoolId, licenseYear },
    select: { studentId: true, source: true },
  })

  if (existingLicenses.length === 0 && bulkLicensedStudentCount > 0 && activeStudents.length > 0) {
    await prisma.studentLicense.createMany({
      data: activeStudents.slice(0, bulkLicensedStudentCount).map((student) => ({
        schoolId,
        studentId: student.id,
        licenseYear,
        source: 'BULK',
      })),
      skipDuplicates: true,
    })

    existingLicenses = await prisma.studentLicense.findMany({
      where: { schoolId, licenseYear },
      select: { studentId: true, source: true },
    })
  }

  const activeStudentIds = activeStudents.map((student) => student.id)
  const licensePayments = activeStudentIds.length
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

  const paymentTotalsByStudentId = new Map<string, number>()
  for (const payment of licensePayments) {
    paymentTotalsByStudentId.set(
      payment.studentId,
      (paymentTotalsByStudentId.get(payment.studentId) ?? 0) + Number(payment.amountPaid)
    )
  }

  const assignedStudentIds = new Set(existingLicenses.map((license) => license.studentId))
  const extraPaidStudentIds = requiredAmountPerStudent > 0
    ? activeStudentIds.filter((studentId) => {
        if (assignedStudentIds.has(studentId)) return false
        return (paymentTotalsByStudentId.get(studentId) ?? 0) >= requiredAmountPerStudent
      })
    : []

  if (extraPaidStudentIds.length > 0) {
    await prisma.studentLicense.createMany({
      data: extraPaidStudentIds.map((studentId) => ({
        schoolId,
        studentId,
        licenseYear,
        source: 'EXTRA_PAYMENT',
      })),
      skipDuplicates: true,
    })

    existingLicenses = await prisma.studentLicense.findMany({
      where: {
        schoolId,
        licenseYear,
        studentId: { in: activeStudentIds },
      },
      select: { studentId: true, source: true },
    })
  }

  const licenseByStudentId = new Map<string, { source: StudentLicenseCoverageSource }>(
    existingLicenses.map((license) => [
      license.studentId,
      { source: license.source as StudentLicenseCoverageSource },
    ])
  )

  const coveredStudents = activeStudentIds.reduce(
    (count, studentId) => (licenseByStudentId.has(studentId) ? count + 1 : count),
    0
  )
  const bulkCoveredStudents = activeStudentIds.reduce(
    (count, studentId) => (licenseByStudentId.get(studentId)?.source === 'BULK' ? count + 1 : count),
    0
  )
  const extraCoveredStudents = activeStudentIds.reduce(
    (count, studentId) => (licenseByStudentId.get(studentId)?.source === 'EXTRA_PAYMENT' ? count + 1 : count),
    0
  )
  const uncoveredStudents = Math.max(activeStudentIds.length - coveredStudents, 0)

  return {
    configured: Boolean(billing),
    onboardingFee: Number(billing?.onboardingFee ?? 0),
    onboardingStatus: billing?.onboardingStatus ?? 'PENDING',
    annualPricePerStudent: requiredAmountPerStudent,
    requiredAmountPerStudent,
    licensedStudentCount: bulkLicensedStudentCount,
    bulkLicensedStudentCount,
    activeStudents: activeStudentIds.length,
    activeStudentIds,
    coveredStudents,
    uncoveredStudents,
    bulkCoveredStudents,
    extraCoveredStudents,
    studentsWithAccess: coveredStudents,
    studentsWithoutAccess: uncoveredStudents,
    studentsNeedingExtraLicensePayment: uncoveredStudents,
    extraLicenseCost: Number((uncoveredStudents * requiredAmountPerStudent).toFixed(2)),
    licenseYear,
    billingYear: billing?.billingYear ?? 0,
    licenseStartDate: billing?.licenseStartDate ?? null,
    licenseEndDate: billing?.licenseEndDate ?? null,
    enabledModules: billing?.enabledModules ?? [],
    notes: billing?.notes ?? null,
    licenseByStudentId,
    paymentTotalsByStudentId,
  }
}