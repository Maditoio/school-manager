import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { updateExpenseSchema, voidExpenseSchema } from '@/lib/validations'
import { ExpenseAuditAction, PaymentMethod } from '@prisma/client'

async function resolveSchoolContext(sessionUser: { id?: string | null; email?: string | null; schoolId?: string | null; role?: string | null }) {
  if (sessionUser.schoolId && sessionUser.id) {
    return { schoolId: sessionUser.schoolId, userId: sessionUser.id }
  }

  if (!sessionUser.email) return null

  const user = await prisma.user.findUnique({
    where: { email: sessionUser.email.toLowerCase() },
    select: { id: true, schoolId: true, role: true },
  })

  if (!user || !user.schoolId || !['SCHOOL_ADMIN', 'FINANCE'].includes(user.role)) {
    return null
  }

  return { schoolId: user.schoolId, userId: user.id }
}

// PATCH /api/expenses/[id] — Approve (SCHOOL_ADMIN only)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ error: 'Only school administrators can approve expenses' }, { status: 403 })
    }

    const context = await resolveSchoolContext(session.user)
    if (!context?.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const { id } = await params
    const existing = await prisma.expense.findFirst({ where: { id, schoolId: context.schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    if (existing.status !== 'RECORDED') {
      return NextResponse.json({ error: 'Only recorded expenses can be approved' }, { status: 422 })
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: { status: 'APPROVED', updatedById: context.userId },
    })

    await prisma.expenseAuditLog.create({
      data: {
        schoolId: context.schoolId,
        expenseId: id,
        actorId: context.userId,
        action: ExpenseAuditAction.STATUS_CHANGED,
        details: {
          before: { status: existing.status },
          after: { status: updated.status },
        },
      },
    })

    return NextResponse.json({ expense: updated })
  } catch (error) {
    console.error('Error approving expense:', error)
    return NextResponse.json({ error: 'Failed to approve expense' }, { status: 500 })
  }
}

// PUT /api/expenses/[id] — Edit fields (APPROVED expenses are immutable; FINANCE cannot approve)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const context = await resolveSchoolContext(session.user)
    if (!context?.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const { id } = await params
    const existing = await prisma.expense.findFirst({ where: { id, schoolId: context.schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Approved expenses are immutable — void and re-record to make corrections
    if (existing.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Approved expenses cannot be edited. Void and re-record to make corrections.' },
        { status: 422 }
      )
    }

    const body = await request.json()
    const validation = updateExpenseSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues }, { status: 400 })
    }

    const payload = validation.data

    // FINANCE cannot approve — only SCHOOL_ADMIN can move status to APPROVED
    if (session.user.role === 'FINANCE' && payload.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Finance users cannot approve expenses. Only school administrators can approve.' },
        { status: 403 }
      )
    }

    // Strip APPROVED from status so FINANCE can never set it through this route
    const resolvedStatus =
      payload.status === 'APPROVED' && session.user.role === 'FINANCE'
        ? existing.status
        : (payload.status ?? existing.status)

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        title: payload.title,
        description: payload.description || null,
        category: payload.category,
        amount: payload.amount,
        expenseDate: new Date(payload.expenseDate),
        paymentMethod: (payload.paymentMethod as PaymentMethod | null) || null,
        vendorName: payload.vendorName || null,
        referenceNumber: payload.referenceNumber || null,
        beneficiaryName: payload.beneficiaryName || null,
        studentId: payload.studentId || null,
        status: resolvedStatus,
        updatedById: context.userId,
      },
    })

    await prisma.expenseAuditLog.create({
      data: {
        schoolId: context.schoolId,
        expenseId: id,
        actorId: context.userId,
        action: existing.status !== updated.status ? ExpenseAuditAction.STATUS_CHANGED : ExpenseAuditAction.UPDATED,
        details: {
          before: {
            title: existing.title,
            category: existing.category,
            amount: existing.amount,
            status: existing.status,
            expenseDate: existing.expenseDate,
          },
          after: {
            title: updated.title,
            category: updated.category,
            amount: updated.amount,
            status: updated.status,
            expenseDate: updated.expenseDate,
          },
        },
      },
    })

    return NextResponse.json({ expense: updated })
  } catch (error) {
    console.error('Error updating expense:', error)
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
  }
}

// DELETE /api/expenses/[id] — Void (requires reason; FINANCE can only void own RECORDED expenses)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const context = await resolveSchoolContext(session.user)
    if (!context?.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    // Reason is required
    const body = await request.json().catch(() => ({}))
    const reasonValidation = voidExpenseSchema.safeParse(body)
    if (!reasonValidation.success) {
      return NextResponse.json({ error: 'A reason is required to void an expense' }, { status: 400 })
    }

    const { id } = await params
    const existing = await prisma.expense.findFirst({ where: { id, schoolId: context.schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    if (existing.status === 'VOID') {
      return NextResponse.json({ error: 'Expense is already voided' }, { status: 422 })
    }

    // FINANCE: can only void RECORDED expenses they themselves recorded
    if (session.user.role === 'FINANCE') {
      if (existing.status === 'APPROVED') {
        return NextResponse.json(
          { error: 'Approved expenses can only be voided by a school administrator.' },
          { status: 403 }
        )
      }
      if (existing.createdById !== context.userId) {
        return NextResponse.json(
          { error: 'You can only void expenses you recorded yourself.' },
          { status: 403 }
        )
      }
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: { status: 'VOID', updatedById: context.userId },
    })

    await prisma.expenseAuditLog.create({
      data: {
        schoolId: context.schoolId,
        expenseId: id,
        actorId: context.userId,
        action: ExpenseAuditAction.STATUS_CHANGED,
        details: {
          before: { status: existing.status },
          after: { status: expense.status },
          reason: reasonValidation.data.reason,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error voiding expense:', error)
    return NextResponse.json({ error: 'Failed to void expense' }, { status: 500 })
  }
}
