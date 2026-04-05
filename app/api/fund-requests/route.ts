import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { ExpenseCategory, FundRequestStatus, UserRole } from '@prisma/client'
import { z } from 'zod'

const REQUESTER_ROLES: UserRole[] = ['FINANCE']
const REVIEWER_ROLES: UserRole[] = ['FINANCE_MANAGER', 'FINANCE', 'SCHOOL_ADMIN']
const ALL_ALLOWED_ROLES: UserRole[] = [...new Set([...REQUESTER_ROLES, ...REVIEWER_ROLES])]

const createFundRequestSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  category: z.nativeEnum(ExpenseCategory),
  amount: z.number().positive(),
  urgency: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
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

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ALL_ALLOWED_ROLES)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ctx = await resolveUserContext(session.user)
    if (!ctx?.schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') as FundRequestStatus | null
    const urgencyFilter = searchParams.get('urgency')

    const where: Record<string, unknown> = { schoolId: ctx.schoolId }

    if (statusFilter && Object.values(FundRequestStatus).includes(statusFilter)) {
      where.status = statusFilter
    }

    if (urgencyFilter === 'URGENT' || urgencyFilter === 'NORMAL') {
      where.urgency = urgencyFilter
    }

    const [requests, settings] = await Promise.all([
      prisma.fundRequest.findMany({
        where,
        include: {
          requestedBy: { select: { firstName: true, lastName: true, email: true, role: true } },
          reviewedBy: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: [{ urgency: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.schoolSettings.findUnique({ where: { schoolId: ctx.schoolId } }),
    ])

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        amount: r.amount,
        urgency: r.urgency,
        status: r.status,
        reviewNote: r.reviewNote,
        reviewedAt: r.reviewedAt,
        expenseId: r.expenseId,
        createdAt: r.createdAt,
        requestedById: r.requestedById,
        requestedByName:
          `${r.requestedBy.firstName ?? ''} ${r.requestedBy.lastName ?? ''}`.trim() || r.requestedBy.email,
        requestedByRole: r.requestedBy.role,
        reviewedByName: r.reviewedBy
          ? `${r.reviewedBy.firstName ?? ''} ${r.reviewedBy.lastName ?? ''}`.trim() || r.reviewedBy.email
          : null,
      })),
      expenseApprovalThreshold: settings?.expenseApprovalThreshold ?? 0,
    })
  } catch (error) {
    console.error('Error fetching fund requests:', error)
    return NextResponse.json({ error: 'Failed to fetch fund requests' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, REQUESTER_ROLES)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ctx = await resolveUserContext(session.user)
    if (!ctx?.schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 400 })
    }

    const body = await request.json()
    const validation = createFundRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues }, { status: 400 })
    }

    const data = validation.data
    const fundRequest = await prisma.fundRequest.create({
      data: {
        schoolId: ctx.schoolId,
        requestedById: ctx.userId,
        title: data.title,
        description: data.description ?? null,
        category: data.category,
        amount: data.amount,
        urgency: data.urgency,
        status: 'PENDING',
      },
    })

    return NextResponse.json({ fundRequest }, { status: 201 })
  } catch (error) {
    console.error('Error creating fund request:', error)
    return NextResponse.json({ error: 'Failed to create fund request' }, { status: 500 })
  }
}
