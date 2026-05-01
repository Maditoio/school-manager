import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { createStripeCheckoutSession } from '@/lib/stripe'

/**
 * POST /api/schools/[schoolId]/licenses/checkout
 * School finance/admin initiates Stripe checkout for student licenses
 */
export async function POST(
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

    const body = await request.json()
    const { studentCount, licenseYear, notes } = body

    if (!studentCount || studentCount <= 0) {
      return NextResponse.json({ error: 'Invalid student count' }, { status: 400 })
    }

    // Get billing info to determine annual price
    const billing = await prisma.schoolBilling.findUnique({
      where: { schoolId },
    })

    if (!billing || !billing.annualPricePerStudent || billing.annualPricePerStudent <= 0) {
      return NextResponse.json(
        { error: 'School license pricing not configured' },
        { status: 400 }
      )
    }

    const totalAmount = billing.annualPricePerStudent * studentCount
    const amountCents = Math.round(totalAmount * 100)

    // Create Stripe checkout
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${origin}/admin/licenses?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${origin}/admin/licenses`

    try {
      const stripeSession = await createStripeCheckoutSession({
        courseId: schoolId,
        courseTitle: `Student Licenses - ${studentCount} students`,
        courseDescription: `Annual license fee for ${studentCount} students (Year: ${licenseYear || new Date().getFullYear()})${
          notes ? ` - ${notes}` : ''
        }`,
        amountCents,
        currency: 'usd',
        successUrl,
        cancelUrl,
        studentId: session.user.id,
      })

      return NextResponse.json({ url: stripeSession.url })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create payment session'
      console.error('Stripe license checkout failed:', errorMessage)
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    console.error('License checkout error:', error)
    return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 })
  }
}
