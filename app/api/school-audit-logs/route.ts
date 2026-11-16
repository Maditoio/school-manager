import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

// GET /api/school-audit-logs — admin audit trail (e.g. student deletions)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (
      (session.user.role === 'SCHOOL_ADMIN' || session.user.role === 'DEPUTY_ADMIN') &&
      !session.user.schoolId
    ) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const takeParam = Number(searchParams.get('take') || '100')
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 200) : 100
    const resourceType = searchParams.get('resourceType')?.trim() || undefined
    const action = searchParams.get('action')?.trim() || undefined

    const where: {
      schoolId?: string
      resourceType?: string
      action?: string
    } = {}

    if (session.user.schoolId) {
      where.schoolId = session.user.schoolId
    }
    if (resourceType) where.resourceType = resourceType
    if (action) where.action = action

    const logs = await prisma.schoolAuditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Error fetching school audit logs:', error)
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}
