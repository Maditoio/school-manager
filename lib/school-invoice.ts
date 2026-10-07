import { prisma } from '@/lib/prisma'

export async function getSchoolInvoice(schoolId: string) {
  const billing = await prisma.schoolBilling.findUnique({
    where: { schoolId },
    select: {
      id: true,
      onboardingFee: true,
      onboardingStatus: true,
      annualPricePerStudent: true,
      billingYear: true,
    },
  })

  const billingYear = billing?.billingYear && billing.billingYear > 0
    ? billing.billingYear
    : new Date().getFullYear()

  const yearStart = new Date(Date.UTC(billingYear, 0, 1))
  const yearEnd = new Date(Date.UTC(billingYear, 11, 31, 23, 59, 59, 999))

  const [activeStudents, annualPayments] = await Promise.all([
    prisma.student.count({
      where: { schoolId, status: 'ACTIVE' },
    }),
    billing
      ? prisma.schoolBillingPayment.findMany({
          where: {
            billingId: billing.id,
            paymentType: 'ANNUAL',
            paymentDate: { gte: yearStart, lte: yearEnd },
          },
          select: { amount: true, paymentType: true },
        })
      : Promise.resolve([]),
  ])

  const annualPricePerStudent = Number(billing?.annualPricePerStudent ?? 0)
  const invoiceAmount = Number((activeStudents * annualPricePerStudent).toFixed(2))
  const amountPaid = Number(
    annualPayments
      .reduce((sum, payment) => sum + payment.amount, 0)
      .toFixed(2)
  )
  const outstanding = Number(Math.max(invoiceAmount - Math.max(amountPaid, 0), 0).toFixed(2))

  return {
    configured: Boolean(billing),
    billingId: billing?.id ?? null,
    onboardingFee: Number(billing?.onboardingFee ?? 0),
    onboardingStatus: billing?.onboardingStatus ?? 'PENDING',
    annualPricePerStudent,
    billingYear,
    activeStudents,
    invoiceAmount,
    amountPaid: Math.max(amountPaid, 0),
    outstanding,
  }
}
