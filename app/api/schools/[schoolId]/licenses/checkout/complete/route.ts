import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { retrieveStripeCheckoutSession } from '@/lib/stripe'

/**
 * GET /api/schools/[schoolId]/licenses/checkout/complete?sessionId=...
 * Complete license payment via Stripe
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

    // Verify school access
    if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 })
    }

    try {
      const stripeSession = await retrieveStripeCheckoutSession(sessionId)

      // Verify payment status
      if (stripeSession.payment_status !== 'paid' || stripeSession.status !== 'complete') {
        return NextResponse.json(
          { error: 'Payment not completed' },
          { status: 400 }
        )
      }

      const paymentAmount = (stripeSession.amount_total || 0) / 100

      // Get billing info
      const billing = await prisma.schoolBilling.findUnique({
        where: { schoolId },
      })

      if (!billing) {
        return NextResponse.json({ error: 'School billing not found' }, { status: 404 })
      }

      // Calculate student count from payment
      const studentsCount = Math.floor(paymentAmount / billing.annualPricePerStudent)

      // Record payment
      const payment = await prisma.schoolBillingPayment.create({
        data: {
          billingId: billing.id,
          amount: paymentAmount,
          paymentType: 'ANNUAL',
          paymentDate: new Date(),
          paymentMethod: 'STRIPE',
          referenceNumber: `STRIPE-${sessionId.substring(0, 12)}`,
          notes: `Paid via Stripe for ${studentsCount} students`,
          recordedById: session.user.id,
        },
      })

      // Update licensed student count (cumulative)
      const allPayments = await prisma.schoolBillingPayment.findMany({
        where: {
          billingId: billing.id,
          paymentType: 'ANNUAL',
        },
        select: { amount: true },
      })

      const totalAnnual = allPayments.reduce((sum, p) => sum + p.amount, 0)
      const totalStudents = Math.floor(totalAnnual / billing.annualPricePerStudent)
      const licenseYear = new Date().getFullYear()

      await prisma.schoolBilling.update({
        where: { id: billing.id },
        data: {
          licensedStudentCount: totalStudents,
          billingYear: licenseYear,
        },
      })

      return NextResponse.json({
        success: true,
        paymentId: payment.id,
        amount: paymentAmount,
        studentsLicensed: studentsCount,
      })
    } catch (stripeError) {
      const errorMessage = stripeError instanceof Error ? stripeError.message : 'Stripe verification failed'
      console.error('Stripe license completion error:', errorMessage)
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    console.error('License payment completion error:', error)
    return NextResponse.json({ error: 'Failed to complete payment' }, { status: 500 })
  }
}
