import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'FINANCE_MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()

    const existing = await prisma.teacherSalary.findFirst({
      where: { id, schoolId: session.user.schoolId! },
      select: { id: true, status: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Salary record not found' }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {}

    if (body.status !== undefined) {
      const status = body.status === 'PAID' ? 'PAID' : 'PENDING'
      updateData.status = status
      updateData.paidAt = status === 'PAID' ? new Date() : null
    }

    if (body.amount !== undefined) {
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
      }
      updateData.amount = amount
    }

    if (body.notes !== undefined) {
      updateData.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
    }

    if (body.paymentDate !== undefined) {
      if (body.paymentDate === null) {
        updateData.paymentDate = null
      } else {
        const pd = new Date(body.paymentDate)
        if (isNaN(pd.getTime())) {
          return NextResponse.json({ error: 'Invalid payment date' }, { status: 400 })
        }
        updateData.paymentDate = pd
      }
    }

    const updated = await prisma.teacherSalary.update({
      where: { id },
      data: updateData,
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json({ salary: updated })
  } catch (error) {
    console.error('Error updating teacher salary:', error)
    return NextResponse.json({ error: 'Failed to update salary' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'FINANCE_MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    const existing = await prisma.teacherSalary.findFirst({
      where: { id, schoolId: session.user.schoolId! },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Salary record not found' }, { status: 404 })
    }

    await prisma.teacherSalary.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting teacher salary:', error)
    return NextResponse.json({ error: 'Failed to delete salary record' }, { status: 500 })
  }
}
