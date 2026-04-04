import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { z } from 'zod'

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'withdraw']),
  reviewNote: z.string().max(500).optional(),
})

async function resolveUserContext(sessionUser: {
  id?: string | null
  email?: string | null
  schoolId?: string | null
  role?: string | null
}) {
  if (sessionUser.id && sessionUser.schoolId) {
    return { userId: sessionUser.id, schoolId: sessionUser.schoolId, role: sessionUser.role }
  }
  if (!sessionUser.email) return null
  const user = await prisma.user.findUnique({
    where: { email: sessionUser.email.toLowerCase() },
    select: { id: true, schoolId: true, role: true },
  })
  if (!user?.schoolId) return null
  return { userId: user.id, schoolId: user.schoolId, role: user.role }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['TEACHER', 'FINANCE', 'FINANCE_MANAGER', 'SCHOOL_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ctx = await resolveUserContext(session.user)
    if (!ctx?.schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 400 })
    }

    const { id } = await params
    const body = await request.json()
    const validation = reviewSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues }, { status: 400 })
    }

    const { action, reviewNote } = validation.data

    const fundRequest = await prisma.fundRequest.findUnique({
      where: { id },
      select: {
        id: true,
        schoolId: true,
        requestedById: true,
        title: true,
        description: true,
        category: true,
        amount: true,
        urgency: true,
        status: true,
      },
    })

    if (!fundRequest || fundRequest.schoolId !== ctx.schoolId) {
      return NextResponse.json({ error: 'Fund request not found' }, { status: 404 })
    }

    if (fundRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending requests can be updated' }, { status: 400 })
    }

    // Withdraw: requester cancels their own request
    if (action === 'withdraw') {
      if (fundRequest.requestedById !== ctx.userId) {
        return NextResponse.json({ error: 'You can only withdraw your own requests' }, { status: 403 })
      }
      const updated = await prisma.fundRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedById: ctx.userId,
          reviewedAt: new Date(),
          reviewNote: 'Withdrawn by requester',
        },
      })
      return NextResponse.json({ fundRequest: updated })
    }

    // Approve / reject — only FINANCE_MANAGER and SCHOOL_ADMIN
    if (!ctx.role || !['FINANCE_MANAGER', 'SCHOOL_ADMIN'].includes(ctx.role)) {
      return NextResponse.json({ error: 'Insufficient permissions to review requests' }, { status: 403 })
    }

    if (action === 'approve') {
      // FINANCE_MANAGER can only approve up to threshold
      if (ctx.role === 'FINANCE_MANAGER') {
        const settings = await prisma.schoolSettings.findUnique({ where: { schoolId: ctx.schoolId } })
        const threshold = settings?.expenseApprovalThreshold ?? 0
        if (threshold <= 0 || fundRequest.amount > threshold) {
          return NextResponse.json(
            { error: `Amount exceeds your approval limit of ${threshold}. Admin approval required.` },
            { status: 403 },
          )
        }
      }

      // Auto-create expense on approval
      const newExpense = await prisma.expense.create({
        data: {
          schoolId: ctx.schoolId,
          title: fundRequest.title,
          description: fundRequest.description ?? null,
          category: fundRequest.category,
          amount: fundRequest.amount,
          expenseDate: new Date(),
          status: 'RECORDED',
          createdById: ctx.userId,
          updatedById: ctx.userId,
        },
      })

      const updated = await prisma.fundRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: ctx.userId,
          reviewedAt: new Date(),
          reviewNote: reviewNote ?? null,
          expenseId: newExpense.id,
        },
      })

      return NextResponse.json({ fundRequest: updated, expenseId: newExpense.id })
    }

    // Reject
    if (!reviewNote?.trim()) {
      return NextResponse.json({ error: 'A reason is required when rejecting a request' }, { status: 400 })
    }

    const updated = await prisma.fundRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: ctx.userId,
        reviewedAt: new Date(),
        reviewNote: reviewNote.trim(),
      },
    })

    return NextResponse.json({ fundRequest: updated })
  } catch (error) {
    console.error('Error reviewing fund request:', error)
    return NextResponse.json({ error: 'Failed to update fund request' }, { status: 500 })
  }
}
