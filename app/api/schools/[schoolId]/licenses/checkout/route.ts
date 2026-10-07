import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/auth-utils'
import { getSchoolInvoice } from '@/lib/school-invoice'
import { createStripeCheckoutSession } from '@/lib/stripe'

/**
 * POST /api/schools/[schoolId]/licenses/checkout
 * Starts Stripe checkout for the school's single annual invoice.
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

    if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const invoice = await getSchoolInvoice(schoolId)
    if (!invoice.configured || invoice.annualPricePerStudent <= 0) {
      return NextResponse.json({ error: 'School pricing is not configured' }, { status: 400 })
    }
    if (invoice.activeStudents <= 0) {
      return NextResponse.json({ error: 'This school has no active students to bill' }, { status: 400 })
    }
    if (invoice.outstanding <= 0) {
      return NextResponse.json({ error: 'This invoice is already paid' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const returnPath = typeof body?.returnPath === 'string' && body.returnPath.startsWith('/') && !body.returnPath.startsWith('//')
      ? body.returnPath
      : '/admin/licenses'

    const amountCents = Math.round(invoice.outstanding * 100)
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${origin}${returnPath}?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${origin}${returnPath}`

    try {
      const stripeSession = await createStripeCheckoutSession({
        courseId: schoolId,
        courseTitle: `School invoice ${invoice.billingYear}`,
        courseDescription: `${invoice.activeStudents} active students × ${invoice.annualPricePerStudent.toFixed(2)}`,
        amountCents,
        currency: 'usd',
        successUrl,
        cancelUrl,
        studentId: session.user.id,
      })

      return NextResponse.json({ url: stripeSession.url, outstanding: invoice.outstanding })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create payment session'
      console.error('Stripe invoice checkout failed:', errorMessage)
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    console.error('Invoice checkout error:', error)
    return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 })
  }
}
