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
    const status = body.status === 'PAID' ? 'PAID' : 'PENDING'

    const existing = await prisma.teacherSalary.findFirst({
      where: { id, schoolId: session.user.schoolId! },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Salary record not found' }, { status: 404 })
    }

    const updated = await prisma.teacherSalary.update({
      where: { id },
      data: {
        status,
        paidAt: status === 'PAID' ? new Date() : null,
      },
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
