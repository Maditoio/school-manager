import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { z } from 'zod'

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'withdraw', 'recordExpense']),
  reviewNote: z.string().max(500).optional(),
  // recordExpense fields
  amount: z.number().positive().optional(),
  expenseDate: z.string().optional(),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
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
    if (!session?.user || !hasRole(session.user.role, ['FINANCE', 'FINANCE_MANAGER', 'SCHOOL_ADMIN', 'DEPUTY_ADMIN'])) {
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
        expenseId: true,
      },
    })

    if (!fundRequest || fundRequest.schoolId !== ctx.schoolId) {
      return NextResponse.json({ error: 'Fund request not found' }, { status: 404 })
    }

    // recordExpense — FINANCE (or SCHOOL_ADMIN) records the actual expense against an approved request
    if (action === 'recordExpense') {
      if (!ctx.role || !(['FINANCE', 'SCHOOL_ADMIN'] as string[]).includes(ctx.role)) {
        return NextResponse.json({ error: 'Only Finance staff can record expenses' }, { status: 403 })
      }
      if (fundRequest.status !== 'APPROVED') {
        return NextResponse.json({ error: 'Can only record an expense against an approved request' }, { status: 400 })
      }
      if (fundRequest.expenseId) {
        return NextResponse.json({ error: 'An expense has already been recorded for this request' }, { status: 409 })
      }

      const amount = validation.data.amount ?? fundRequest.amount
      const expenseDateRaw = validation.data.expenseDate
      const expenseDate = expenseDateRaw ? new Date(expenseDateRaw) : new Date()
      if (isNaN(expenseDate.getTime())) {
        return NextResponse.json({ error: 'Invalid expense date' }, { status: 400 })
      }

      const newExpense = await prisma.expense.create({
        data: {
          schoolId: ctx.schoolId,
          title: fundRequest.title,
          description: validation.data.notes ?? fundRequest.description ?? null,
          category: fundRequest.category,
          amount,
          expenseDate,
          referenceNumber: validation.data.referenceNumber ?? null,
          status: 'RECORDED',
          createdById: ctx.userId,
          updatedById: ctx.userId,
        },
      })

      const updated = await prisma.fundRequest.update({
        where: { id },
        data: { expenseId: newExpense.id },
      })

      return NextResponse.json({ fundRequest: updated, expenseId: newExpense.id })
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
      // FINANCE_MANAGER can only approve up to threshold (if a threshold is configured)
      if (ctx.role === 'FINANCE_MANAGER') {
        const settings = await prisma.schoolSettings.findUnique({ where: { schoolId: ctx.schoolId } })
        const threshold = settings?.expenseApprovalThreshold ?? 0
        if (threshold > 0 && fundRequest.amount > threshold) {
          return NextResponse.json(
            { error: `Amount exceeds your approval limit of ${threshold}. Admin approval required.` },
            { status: 403 },
          )
        }
      }

      // Approve — FINANCE role will record the actual expense later once invoice is available
      const updated = await prisma.fundRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: ctx.userId,
          reviewedAt: new Date(),
          reviewNote: reviewNote ?? null,
        },
      })

      return NextResponse.json({ fundRequest: updated })
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
