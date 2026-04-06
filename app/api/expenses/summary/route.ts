import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

async function resolveSchoolContext(sessionUser: {
  id?: string | null
  email?: string | null
  schoolId?: string | null
  role?: string | null
}) {
  if (sessionUser.schoolId && sessionUser.id) {
    return { schoolId: sessionUser.schoolId, userId: sessionUser.id }
  }
  if (!sessionUser.email) return null
  const user = await prisma.user.findUnique({
    where: { email: sessionUser.email.toLowerCase() },
    select: { id: true, schoolId: true, role: true },
  })
  if (!user?.schoolId || !['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE', 'FINANCE_MANAGER'].includes(user.role)) return null
  return { schoolId: user.schoolId, userId: user.id }
}

// GET /api/expenses/summary
// Returns: income (fee payments), expenses, and net for a date window.
// Query params: from (ISO date), to (ISO date) — defaults to current calendar month.
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE', 'FINANCE_MANAGER'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ctx = await resolveSchoolContext(session.user)
    if (!ctx?.schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const now = new Date()

    // Default: current calendar month
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))

    const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : defaultFrom
    const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : defaultTo

    const schoolId = ctx.schoolId

    // Fetch fee payments (income) and expenses in parallel
    const [feePayments, expenses] = await Promise.all([
      prisma.$queryRaw<Array<{ total: string }>>`
        SELECT COALESCE(SUM(amount_paid), 0)::text AS total
        FROM fee_payments
        WHERE school_id = ${schoolId}
          AND payment_date >= ${from}
          AND payment_date <= ${to}
      `,
      prisma.expense.aggregate({
        where: {
          schoolId,
          status: { not: 'VOID' },
          expenseDate: { gte: from, lte: to },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ])

    const totalIncome = Number(feePayments[0]?.total ?? 0)
    const totalExpenses = expenses._sum.amount ?? 0
    const net = Number((totalIncome - totalExpenses).toFixed(2))

    // Also fetch expense breakdown by category for the period
    const categoryBreakdown = await prisma.expense.groupBy({
      by: ['category'],
      where: {
        schoolId,
        status: { not: 'VOID' },
        expenseDate: { gte: from, lte: to },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    })

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      net,
      expenseCount: expenses._count,
      categoryBreakdown: categoryBreakdown.map((row) => ({
        category: row.category,
        amount: Number((row._sum.amount ?? 0).toFixed(2)),
      })),
    })
  } catch (error) {
    console.error('Error fetching expense summary:', error)
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 })
  }
}
