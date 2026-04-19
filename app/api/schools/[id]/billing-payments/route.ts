import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentType: z.enum(['ONBOARDING', 'ANNUAL', 'ADJUSTMENT']),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  paymentMethod: z.string().max(100).optional(),
  referenceNumber: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
})

// GET /api/schools/[id]/billing-payments
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const billing = await prisma.schoolBilling.findUnique({
      where: { schoolId: id },
      select: { id: true, onboardingFee: true, onboardingStatus: true },
    })

    if (!billing) {
      return NextResponse.json({ payments: [], totalPaid: 0 })
    }

    const payments = await prisma.schoolBillingPayment.findMany({
      where: { billingId: billing.id },
      include: {
        recordedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { paymentDate: 'desc' },
    })

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

    // Auto-reconcile: if ONBOARDING payments cover the fee but status is still PENDING, fix it
    let finalOnboardingStatus = billing.onboardingStatus
    if (billing.onboardingStatus === 'PENDING' && billing.onboardingFee > 0) {
      const onboardingTotal = payments
        .filter((p) => p.paymentType === 'ONBOARDING')
        .reduce((sum, p) => sum + p.amount, 0)
      if (onboardingTotal >= billing.onboardingFee) {
        await prisma.schoolBilling.update({
          where: { id: billing.id },
          data: { onboardingStatus: 'PAID' },
        })
        finalOnboardingStatus = 'PAID'
      }
    }

    return NextResponse.json({ payments, totalPaid, onboardingStatus: finalOnboardingStatus })
  } catch (error) {
    console.error('Error fetching billing payments:', error)
    return NextResponse.json({ error: 'Failed to fetch billing payments' }, { status: 500 })
  }
}

// POST /api/schools/[id]/billing-payments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validation = createPaymentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues }, { status: 400 })
    }

    const { amount, paymentType, paymentDate, paymentMethod, referenceNumber, notes } = validation.data

    // Ensure billing record exists (upsert if needed)
    const billing = await prisma.schoolBilling.upsert({
      where: { schoolId: id },
      create: { schoolId: id },
      update: {},
      select: {
        id: true,
        onboardingFee: true,
        onboardingStatus: true,
        annualPricePerStudent: true,
        licensedStudentCount: true,
      },
    })

    const payment = await prisma.schoolBillingPayment.create({
      data: {
        billingId: billing.id,
        amount,
        paymentType,
        paymentDate: new Date(paymentDate),
        paymentMethod: paymentMethod ?? null,
        referenceNumber: referenceNumber ?? null,
        notes: notes ?? null,
        recordedById: session.user.id,
      },
      include: {
        recordedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    })

    // Auto-update onboardingStatus when ONBOARDING payments cover the fee
    let finalOnboardingStatus = billing.onboardingStatus
    if (paymentType === 'ONBOARDING' && billing.onboardingStatus === 'PENDING') {
      const onboardingTotal = await prisma.schoolBillingPayment.aggregate({
        where: { billingId: billing.id, paymentType: 'ONBOARDING' },
        _sum: { amount: true },
      })
      const totalOnboardingPaid = onboardingTotal._sum.amount ?? 0
      if (totalOnboardingPaid >= billing.onboardingFee && billing.onboardingFee > 0) {
        await prisma.schoolBilling.update({
          where: { id: billing.id },
          data: { onboardingStatus: 'PAID' },
        })
        finalOnboardingStatus = 'PAID'
      }
    }

    return NextResponse.json({ payment, onboardingStatus: finalOnboardingStatus }, { status: 201 })
  } catch (error) {
    console.error('Error creating billing payment:', error)
    return NextResponse.json({ error: 'Failed to create billing payment' }, { status: 500 })
  }
}
