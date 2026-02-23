import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ParentInteractionDelegate = {
  findMany: (args: {
    where: Record<string, unknown>
    include: {
      parent: {
        select: {
          id: true
          firstName: true
          lastName: true
          email: true
        }
      }
    }
    orderBy: { createdAt: 'desc' }
    take: number
  }) => Promise<unknown[]>
  create: (args: {
    data: {
      schoolId: string | null
      parentId: string
      childId: string | null
      resourceType: string
      resourceId: string
      action: string
      metadata: Record<string, unknown> | null
    }
  }) => Promise<unknown>
}

const db = prisma as unknown as {
  parentInteraction?: ParentInteractionDelegate
}

type InteractionBody = {
  childId?: string
  resourceType: 'assessment' | 'announcement'
  resourceId: string
  action?: 'click' | 'view'
  metadata?: Record<string, unknown>
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!db.parentInteraction) {
      return NextResponse.json(
        { error: 'Interaction logging unavailable' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const takeParam = Number(searchParams.get('take') || '100')
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 200) : 100

    const where: Record<string, unknown> = {}

    if (session.user.role === 'SCHOOL_ADMIN') {
      if (!session.user.schoolId) {
        return NextResponse.json({ error: 'School ID required' }, { status: 400 })
      }
      where.schoolId = session.user.schoolId
    }

    const logs = await db.parentInteraction.findMany({
      where,
      include: {
        parent: {
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
    console.error('Error fetching parent interactions:', error)
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'PARENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as InteractionBody

    if (!body?.resourceType || !body?.resourceId) {
      return NextResponse.json(
        { error: 'resourceType and resourceId are required' },
        { status: 400 }
      )
    }

    if (!['assessment', 'announcement'].includes(body.resourceType)) {
      return NextResponse.json({ error: 'Invalid resourceType' }, { status: 400 })
    }

    if (!db.parentInteraction) {
      return NextResponse.json(
        { error: 'Interaction logging unavailable' },
        { status: 500 }
      )
    }

    await db.parentInteraction.create({
      data: {
        schoolId: session.user.schoolId,
        parentId: session.user.id,
        childId: body.childId || null,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        action: body.action || 'click',
        metadata: body.metadata || null,
      },
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Error logging parent interaction:', error)
    return NextResponse.json({ error: 'Failed to log interaction' }, { status: 500 })
  }
}
