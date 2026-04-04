import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { createExpenseSchema } from '@/lib/validations'
import { ExpenseAuditAction, ExpenseCategory, ExpenseStatus, PaymentMethod } from '@prisma/client'

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

function monthWindow(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
  return { start, end }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const context = await resolveSchoolContext(session.user)
    if (!context?.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''
    const category = searchParams.get('category') as ExpenseCategory | null
    const status = searchParams.get('status') as ExpenseStatus | null
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: Record<string, unknown> = { schoolId: context.schoolId }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { vendorName: { contains: q, mode: 'insensitive' } },
        { beneficiaryName: { contains: q, mode: 'insensitive' } },
        { referenceNumber: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    }

    if (category && Object.values(ExpenseCategory).includes(category)) {
      where.category = category
    }

    if (status && Object.values(ExpenseStatus).includes(status)) {
      where.status = status
    }

    if (from || to) {
      where.expenseDate = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      }
    }

    const [expenses, recentAuditLogs, students] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          createdBy: { select: { firstName: true, lastName: true, email: true } },
          student: { select: { firstName: true, lastName: true, admissionNumber: true } },
          _count: { select: { auditLogs: true } },
        },
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.expenseAuditLog.findMany({
        where: { schoolId: context.schoolId },
        include: {
          actor: { select: { firstName: true, lastName: true, email: true } },
          expense: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.student.findMany({
        where: { schoolId: context.schoolId },
        select: { id: true, firstName: true, lastName: true, admissionNumber: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        take: 300,
      }),
    ])

    const { start, end } = monthWindow()
    const activeExpenses = expenses.filter((expense) => expense.status !== 'VOID')
    const monthExpenses = activeExpenses.filter((expense) => expense.expenseDate >= start && expense.expenseDate < end)
    const peopleCategories = new Set<ExpenseCategory>(['SALARIES', 'BURSARIES', 'SPECIAL_DISCOUNTS'])

    const summary = {
      totalAmount: activeExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      monthAmount: monthExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      peopleAmount: activeExpenses.filter((expense) => peopleCategories.has(expense.category)).reduce((sum, expense) => sum + expense.amount, 0),
      recordedCount: expenses.filter((expense) => expense.status === 'RECORDED').length,
      approvedCount: expenses.filter((expense) => expense.status === 'APPROVED').length,
      voidCount: expenses.filter((expense) => expense.status === 'VOID').length,
    }

    return NextResponse.json({
      expenses: expenses.map((expense) => ({
        id: expense.id,
        title: expense.title,
        description: expense.description,
        category: expense.category,
        amount: expense.amount,
        expenseDate: expense.expenseDate,
        paymentMethod: expense.paymentMethod,
        vendorName: expense.vendorName,
        referenceNumber: expense.referenceNumber,
        beneficiaryName: expense.beneficiaryName,
        status: expense.status,
        studentId: expense.studentId,
        studentName: expense.student ? `${expense.student.firstName} ${expense.student.lastName}` : null,
        createdById: expense.createdById,
        createdByName: `${expense.createdBy.firstName || ''} ${expense.createdBy.lastName || ''}`.trim() || expense.createdBy.email,
        auditCount: expense._count.auditLogs,
        updatedAt: expense.updatedAt,
      })),
      recentAuditLogs: recentAuditLogs.map((log) => ({
        id: log.id,
        expenseId: log.expenseId,
        expenseTitle: log.expense.title,
        action: log.action,
        details: log.details,
        createdAt: log.createdAt,
        actorName: log.actor ? `${log.actor.firstName || ''} ${log.actor.lastName || ''}`.trim() || log.actor.email : 'System',
      })),
      students: students.map((student) => ({
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
      })),
      summary,
    })
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const context = await resolveSchoolContext(session.user)
    if (!context?.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const body = await request.json()
    const validation = createExpenseSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues }, { status: 400 })
    }

    const payload = validation.data
    const expense = await prisma.expense.create({
      data: {
        schoolId: context.schoolId,
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
        status: payload.status || 'RECORDED',
        createdById: context.userId,
        updatedById: context.userId,
      },
    })

    await prisma.expenseAuditLog.create({
      data: {
        schoolId: context.schoolId,
        expenseId: expense.id,
        actorId: context.userId,
        action: ExpenseAuditAction.CREATED,
        details: {
          after: {
            title: expense.title,
            category: expense.category,
            amount: expense.amount,
            status: expense.status,
            expenseDate: expense.expenseDate,
          },
        },
      },
    })

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}