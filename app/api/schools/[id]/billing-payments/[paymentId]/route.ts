import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE /api/schools/[id]/billing-payments/[paymentId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { paymentId } = await params

    const payment = await prisma.schoolBillingPayment.findUnique({
      where: { id: paymentId },
      select: { id: true },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    await prisma.schoolBillingPayment.delete({ where: { id: paymentId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting billing payment:', error)
    return NextResponse.json({ error: 'Failed to delete billing payment' }, { status: 500 })
  }
}
