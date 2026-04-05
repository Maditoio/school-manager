import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { UserRole } from '@prisma/client'

const ALLOWED_ROLES: UserRole[] = ['SCHOOL_ADMIN', 'FINANCE', 'FINANCE_MANAGER', 'TEACHER']

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

/**
 * GET /api/meeting-agenda
 *
 * Returns structured meeting talking points generated from fund requests
 * submitted within the past 7 days (or a custom `from`/`to` window).
 *
 * Accessible by: SCHOOL_ADMIN, FINANCE, FINANCE_MANAGER, TEACHER
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ALLOWED_ROLES)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ctx = await resolveUserContext(session.user)
    if (!ctx?.schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    // Default to the past 7 days if no range is specified
    const to = toParam ? new Date(toParam) : new Date()
    const from = fromParam
      ? new Date(fromParam)
      : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)

    to.setHours(23, 59, 59, 999)
    from.setHours(0, 0, 0, 0)

    const [requests, settings] = await Promise.all([
      prisma.fundRequest.findMany({
        where: {
          schoolId: ctx.schoolId,
          createdAt: { gte: from, lte: to },
        },
        include: {
          requestedBy: {
            select: { firstName: true, lastName: true, email: true, role: true },
          },
          reviewedBy: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: [{ urgency: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.schoolSettings.findUnique({ where: { schoolId: ctx.schoolId } }),
    ])

    const threshold = settings?.expenseApprovalThreshold ?? 0

    // Group by status
    const pending = requests.filter((r) => r.status === 'PENDING')
    const approved = requests.filter((r) => r.status === 'APPROVED')
    const rejected = requests.filter((r) => r.status === 'REJECTED')

    // Build urgency breakdown for pending
    const urgentPending = pending.filter((r) => r.urgency === 'URGENT')
    const normalPending = pending.filter((r) => r.urgency === 'NORMAL')

    // Category totals across all requests
    const categoryTotals: Record<string, { count: number; total: number }> = {}
    for (const r of requests) {
      if (!categoryTotals[r.category]) categoryTotals[r.category] = { count: 0, total: 0 }
      categoryTotals[r.category].count++
      categoryTotals[r.category].total += r.amount
    }

    // Requests above approval threshold
    const aboveThreshold = pending.filter((r) => threshold > 0 && r.amount > threshold)

    // Total amounts
    const totalRequested = requests.reduce((s, r) => s + r.amount, 0)
    const totalApproved = approved.reduce((s, r) => s + r.amount, 0)
    const totalPending = pending.reduce((s, r) => s + r.amount, 0)

    const formatName = (u: { firstName: string | null; lastName: string | null; email: string }) =>
      `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      periodFrom: from.toISOString(),
      periodTo: to.toISOString(),
      summary: {
        total: requests.length,
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length,
        totalRequested,
        totalApproved,
        totalPending,
      },
      talkingPoints: [
        // ── 1. Urgent items ──────────────────────────────────────────
        urgentPending.length > 0
          ? {
              section: 'Urgent Items Requiring Immediate Decision',
              priority: 'high',
              points: urgentPending.map((r) => ({
                id: r.id,
                title: r.title,
                amount: r.amount,
                category: r.category,
                requestedBy: formatName(r.requestedBy),
                requestedByRole: r.requestedBy.role,
                description: r.description,
                requiresAdminApproval: threshold > 0 && r.amount > threshold,
                date: r.createdAt,
              })),
            }
          : null,

        // ── 2. Standard pending ──────────────────────────────────────
        normalPending.length > 0
          ? {
              section: 'Pending Requests for Review',
              priority: 'medium',
              points: normalPending.map((r) => ({
                id: r.id,
                title: r.title,
                amount: r.amount,
                category: r.category,
                requestedBy: formatName(r.requestedBy),
                requestedByRole: r.requestedBy.role,
                description: r.description,
                requiresAdminApproval: threshold > 0 && r.amount > threshold,
                date: r.createdAt,
              })),
            }
          : null,

        // ── 3. Above-threshold items ─────────────────────────────────
        aboveThreshold.length > 0
          ? {
              section: 'Items Requiring Administrator Sign-Off',
              priority: 'high',
              note: `These requests exceed the Finance Manager delegation limit of R ${threshold.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} and must be approved by the School Administrator.`,
              points: aboveThreshold.map((r) => ({
                id: r.id,
                title: r.title,
                amount: r.amount,
                category: r.category,
                requestedBy: formatName(r.requestedBy),
                requestedByRole: r.requestedBy.role,
                description: r.description,
                date: r.createdAt,
              })),
            }
          : null,

        // ── 4. Approved this week ────────────────────────────────────
        approved.length > 0
          ? {
              section: 'Approved This Period',
              priority: 'low',
              points: approved.map((r) => ({
                id: r.id,
                title: r.title,
                amount: r.amount,
                category: r.category,
                requestedBy: formatName(r.requestedBy),
                reviewedBy: r.reviewedBy ? formatName(r.reviewedBy) : null,
                date: r.reviewedAt ?? r.createdAt,
              })),
            }
          : null,

        // ── 5. Category spend breakdown ──────────────────────────────
        Object.keys(categoryTotals).length > 0
          ? {
              section: 'Category Spend Overview',
              priority: 'info',
              points: Object.entries(categoryTotals)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([category, data]) => ({
                  category,
                  count: data.count,
                  total: data.total,
                })),
            }
          : null,
      ].filter(Boolean),

      rawRequests: requests.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        amount: r.amount,
        urgency: r.urgency,
        status: r.status,
        reviewNote: r.reviewNote,
        createdAt: r.createdAt,
        requestedByName: formatName(r.requestedBy),
        requestedByRole: r.requestedBy.role,
        reviewedByName: r.reviewedBy ? formatName(r.reviewedBy) : null,
      })),
    })
  } catch (error) {
    console.error('Error generating meeting agenda:', error)
    return NextResponse.json({ error: 'Failed to generate meeting agenda' }, { status: 500 })
  }
}
