import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BillingPaymentType, SchoolOnboardingStatus } from '@prisma/client'

function parseDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

// GET /api/schools/billing-payments - super admin global payments list with filters
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('schoolId') || undefined
    const paymentTypeRaw = searchParams.get('paymentType') || undefined
    const onboardingStatusRaw = searchParams.get('onboardingStatus') || undefined
    const fromDate = parseDate(searchParams.get('fromDate'))
    const toDate = parseDate(searchParams.get('toDate'))

    const paymentType = paymentTypeRaw && Object.values(BillingPaymentType).includes(paymentTypeRaw as BillingPaymentType)
      ? (paymentTypeRaw as BillingPaymentType)
      : undefined
    const onboardingStatus = onboardingStatusRaw && Object.values(SchoolOnboardingStatus).includes(onboardingStatusRaw as SchoolOnboardingStatus)
      ? (onboardingStatusRaw as SchoolOnboardingStatus)
      : undefined

    const payments = await prisma.schoolBillingPayment.findMany({
      where: {
        ...(paymentType && { paymentType }),
        ...(fromDate || toDate
          ? {
              paymentDate: {
                ...(fromDate && { gte: fromDate }),
                ...(toDate && { lte: toDate }),
              },
            }
          : {}),
        billing: {
          ...(schoolId && { schoolId }),
          ...(onboardingStatus && { onboardingStatus }),
        },
      },
      include: {
        billing: {
          select: {
            schoolId: true,
            onboardingStatus: true,
            annualPricePerStudent: true,
            licensedStudentCount: true,
            billingYear: true,
            school: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        recordedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    })

    const totalAmount = payments.reduce((sum, item) => sum + item.amount, 0)

    return NextResponse.json({
      payments,
      summary: {
        count: payments.length,
        totalAmount,
      },
    })
  } catch (error) {
    console.error('Error fetching global billing payments:', error)
    return NextResponse.json({ error: 'Failed to fetch billing payments' }, { status: 500 })
  }
}
