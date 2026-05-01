import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { createStripeCheckoutSession } from '@/lib/stripe'

/**
 * POST /api/schools/[schoolId]/onboarding/checkout
 * School finance/admin initiates Stripe checkout for onboarding fee
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

    // Get school info
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    })

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }

    // Get billing info
    const billing = await prisma.schoolBilling.findUnique({
      where: { schoolId },
    })

    if (!billing || !billing.onboardingFee || billing.onboardingFee <= 0) {
      return NextResponse.json(
        { error: 'Onboarding fee not configured or already paid' },
        { status: 400 }
      )
    }

    if (billing.onboardingStatus === 'PAID') {
      return NextResponse.json(
        { error: 'Onboarding fee already paid' },
        { status: 400 }
      )
    }

    const amountCents = Math.round(billing.onboardingFee * 100)

    // Create Stripe checkout
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${origin}/admin/settings/billing?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${origin}/admin/settings/billing`

    try {
      const stripeSession = await createStripeCheckoutSession({
        courseId: schoolId,
        courseTitle: `${school.name} - Onboarding Fee`,
        courseDescription: `System onboarding and setup fee for ${school.name}`,
        amountCents,
        currency: 'usd',
        successUrl,
        cancelUrl,
        studentId: session.user.id,
      })

      return NextResponse.json({ url: stripeSession.url })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create payment session'
      console.error('Stripe onboarding checkout failed:', errorMessage)
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    console.error('Onboarding checkout error:', error)
    return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 })
  }
}
