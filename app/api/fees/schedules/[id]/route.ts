import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

// PATCH /api/fees/schedules/[id] — approve or reject a fee schedule (SCHOOL_ADMIN only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Schedule ID required' }, { status: 400 })
    }

    // Resolve schoolId from session
    const sessionUser = session.user
    let schoolId: string | null = null
    let userId: string | null = null

    if (
      typeof sessionUser.id === 'string' &&
      typeof sessionUser.schoolId === 'string' &&
      sessionUser.schoolId.length > 0
    ) {
      schoolId = sessionUser.schoolId
      userId = sessionUser.id
    } else if (typeof sessionUser.email === 'string') {
      const user = await prisma.user.findUnique({
        where: { email: sessionUser.email.toLowerCase() },
        select: { id: true, schoolId: true, role: true },
      })
      if (user?.schoolId && (user.role === 'SCHOOL_ADMIN' || user.role === 'DEPUTY_ADMIN')) {
        schoolId = user.schoolId
        userId = user.id
      }
    }

    if (!schoolId || !userId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const body = await request.json()
    const action = body?.action // 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be approve or reject' }, { status: 400 })
    }

    // Find the schedule
    const schedule = await prisma.feeSchedule.findUnique({
      where: { id },
    })

    if (!schedule || schedule.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Fee schedule not found' }, { status: 404 })
    }

    if (schedule.status !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        { error: 'Only pending schedules can be approved or rejected' },
        { status: 409 }
      )
    }

    if (action === 'approve') {
      const updated = await prisma.feeSchedule.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: userId,
          approvedAt: new Date(),
        },
      })
      return NextResponse.json({ schedule: updated })
    }

    // action === 'reject': delete the pending schedule so finance can revise and resubmit
    await prisma.feeSchedule.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('Error updating fee schedule:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Failed to update fee schedule',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    )
  }
}
