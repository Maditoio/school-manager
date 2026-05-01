import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createStripeCheckoutSession } from '@/lib/stripe'

/**
 * POST /api/student/fees/[invoiceId]/checkout
 * Student initiates Stripe checkout for a specific fee invoice
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { invoiceId } = await params

    // Get invoice details
    const invoice = await prisma.feeInvoice.findFirst({
      where: {
        id: invoiceId,
        schoolId: session.user.schoolId!,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        schedule: { select: { periodType: true, year: true, month: true, semester: true } },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Verify student owns this invoice
    if (invoice.student.id !== session.user.studentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if already paid
    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 })
    }

    // Calculate remaining balance
    const payments = await prisma.feePayment.findMany({
      where: { invoiceId: invoice.id },
      select: { amountPaid: true },
    })

    const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0)
    const balance = Math.max(0, invoice.amountDue - totalPaid)

    if (balance <= 0) {
      return NextResponse.json({ error: 'Invoice already fully paid' }, { status: 400 })
    }

    // Create Stripe checkout
    const amountCents = Math.round(balance * 100)
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${origin}/student/fees/invoice/${invoiceId}?payment_complete=true`
    const cancelUrl = `${origin}/student/fees/invoice/${invoiceId}`

    const schoolSettings = await prisma.schoolSettings.findUnique({
      where: { schoolId: session.user.schoolId! },
      select: { currency: true },
    })

    const periodLabel = `${invoice.schedule.periodType}${invoice.schedule.year}${
      invoice.schedule.month ? `-${String(invoice.schedule.month).padStart(2, '0')}` : ''
    }${invoice.schedule.semester ? `-Sem${invoice.schedule.semester}` : ''}`

    try {
      const stripeSession = await createStripeCheckoutSession({
        courseId: invoice.id,
        courseTitle: `School Fees - ${periodLabel}`,
        courseDescription: `Fee payment for ${invoice.student.firstName} ${invoice.student.lastName}`,
        amountCents,
        currency: 'usd',
        successUrl,
        cancelUrl,
        studentId: session.user.studentId!,
      })

      return NextResponse.json({ url: stripeSession.url })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create payment session'
      console.error('Stripe fee checkout failed:', errorMessage)
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    console.error('Fee checkout error:', error)
    return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 })
  }
}
