import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retrieveStripeCheckoutSession } from '@/lib/stripe'

/**
 * GET /api/student/fees/[invoiceId]/checkout/complete?sessionId=...
 * Complete student fee payment via Stripe
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { invoiceId } = await params
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 })
    }

    // Retrieve Stripe session
    try {
      const stripeSession = await retrieveStripeCheckoutSession(sessionId)

      // Verify payment status
      if (stripeSession.payment_status !== 'paid' || stripeSession.status !== 'complete') {
        return NextResponse.json(
          { error: 'Payment not completed. Status: ' + stripeSession.payment_status },
          { status: 400 }
        )
      }

      // Verify invoice exists and belongs to student
      const invoice = await prisma.feeInvoice.findFirst({
        where: {
          id: invoiceId,
          schoolId: session.user.schoolId!,
        },
        include: {
          student: true,
        },
      })

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }

      if (invoice.student.id !== session.user.studentId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      // Record payment
      const paymentAmount = (stripeSession.amount_total || 0) / 100

      const feePayment = await prisma.feePayment.create({
        data: {
          schoolId: session.user.schoolId!,
          scheduleId: invoice.scheduleId,
          studentId: invoice.studentId,
          paymentNumber: `STRIPE-${sessionId.substring(0, 12)}`,
          amountPaid: paymentAmount,
          paymentDate: new Date(),
          paymentMethod: 'STRIPE',
          invoiceId: invoice.id,
          receivedBy: session.user.id,
        },
      })

      // Update invoice status if fully paid
      const totalPayments = await prisma.feePayment.aggregate({
        where: { invoiceId: invoice.id },
        _sum: { amountPaid: true },
      })

      const totalPaid = totalPayments._sum.amountPaid || 0
      if (totalPaid >= invoice.amountDue) {
        await prisma.feeInvoice.update({
          where: { id: invoice.id },
          data: { status: totalPaid > invoice.amountDue ? 'PAID' : 'PARTIAL' },
        })
      } else {
        await prisma.feeInvoice.update({
          where: { id: invoice.id },
          data: { status: 'PARTIAL' },
        })
      }

      return NextResponse.json({
        success: true,
        paymentId: feePayment.id,
        amount: paymentAmount,
      })
    } catch (stripeError) {
      const errorMessage = stripeError instanceof Error ? stripeError.message : 'Stripe verification failed'
      console.error('Stripe fee completion error:', errorMessage)
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    console.error('Fee payment completion error:', error)
    return NextResponse.json({ error: 'Failed to complete payment' }, { status: 500 })
  }
}
