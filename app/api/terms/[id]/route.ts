import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

// PATCH /api/terms/[id] - update lock state, dates, or mark as current
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const schoolId = session.user.role === 'SUPER_ADMIN'
      ? (typeof body?.schoolId === 'string' ? body.schoolId : null)
      : (session.user.schoolId || null)

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const term = await prisma.term.findFirst({
      where: {
        id,
        schoolId,
      },
      select: { id: true },
    })

    if (!term) {
      return NextResponse.json({ error: 'Term not found' }, { status: 404 })
    }

    const updates: {
      name?: string
      startDate?: Date
      endDate?: Date
      isLocked?: boolean
      isCurrent?: boolean
    } = {}

    if (typeof body?.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim()
    }

    if (typeof body?.startDate === 'string') {
      const parsed = new Date(body.startDate)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 })
      }
      updates.startDate = parsed
    }

    if (typeof body?.endDate === 'string') {
      const parsed = new Date(body.endDate)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 })
      }
      updates.endDate = parsed
    }

    if (typeof body?.isLocked === 'boolean') {
      updates.isLocked = body.isLocked
    }

    if (body?.isCurrent === true) {
      await prisma.$transaction([
        prisma.term.updateMany({
          where: { schoolId },
          data: { isCurrent: false },
        }),
        prisma.term.update({
          where: { id },
          data: { ...updates, isCurrent: true },
        }),
      ])

      const updated = await prisma.term.findUnique({
        where: { id },
      })

      return NextResponse.json({ term: updated })
    }

    const updated = await prisma.term.update({
      where: { id },
      data: updates,
    })

    return NextResponse.json({ term: updated })
  } catch (error) {
    console.error('Error updating term:', error)
    return NextResponse.json({ error: 'Failed to update term' }, { status: 500 })
  }
}
