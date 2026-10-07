import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { retrieveStripeCheckoutSession } from '@/lib/stripe'

/**
 * GET /api/schools/[schoolId]/licenses/checkout/complete?sessionId=...
 * Records the paid school invoice as one annual payment.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  try {
    const session = await auth()
    if (
      !session?.user ||
      !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE', 'FINANCE_MANAGER'])
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { schoolId } = await params

    if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const sessionId = new URL(request.url).searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 })
    }

    const referenceNumber = `STRIPE-${sessionId.slice(0, 12)}`

    try {
      const billing = await prisma.schoolBilling.findUnique({
        where: { schoolId },
        select: { id: true },
      })
      if (!billing) {
        return NextResponse.json({ error: 'School billing not found' }, { status: 404 })
      }

      const existing = await prisma.schoolBillingPayment.findFirst({
        where: { billingId: billing.id, referenceNumber },
        select: { id: true, amount: true },
      })
      if (existing) {
        return NextResponse.json({ success: true, paymentId: existing.id, amount: existing.amount })
      }

      const stripeSession = await retrieveStripeCheckoutSession(sessionId)
      if (stripeSession.payment_status !== 'paid' || stripeSession.status !== 'complete') {
        return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
      }

      const paymentAmount = (stripeSession.amount_total || 0) / 100
      const payment = await prisma.schoolBillingPayment.create({
        data: {
          billingId: billing.id,
          amount: paymentAmount,
          paymentType: 'ANNUAL',
          paymentDate: new Date(),
          paymentMethod: 'STRIPE',
          referenceNumber,
          notes: 'Annual school invoice paid via Stripe',
          recordedById: session.user.id,
        },
      })

      return NextResponse.json({
        success: true,
        paymentId: payment.id,
        amount: paymentAmount,
      })
    } catch (stripeError) {
      const errorMessage = stripeError instanceof Error ? stripeError.message : 'Stripe verification failed'
      console.error('Stripe invoice completion error:', errorMessage)
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    console.error('Invoice payment completion error:', error)
    return NextResponse.json({ error: 'Failed to complete payment' }, { status: 500 })
  }
}
