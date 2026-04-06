import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/users/[id]/suspend - Suspend or unsuspend a user (SUPER_ADMIN only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: userId } = await params
    const body = await request.json()
    const suspended = Boolean(body.suspended)
    const reason = typeof body.reason === 'string' ? body.reason.trim() : null

    // Prevent super admin from suspending themselves
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'You cannot suspend your own account' }, { status: 400 })
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent suspending other super admins
    if (target.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Super admin accounts cannot be suspended' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        suspended,
        suspendedAt: suspended ? new Date() : null,
        suspensionReason: suspended ? (reason || null) : null,
      },
      select: {
        id: true,
        email: true,
        suspended: true,
        suspendedAt: true,
        suspensionReason: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error updating user suspension:', error)
    return NextResponse.json(
      { error: 'Failed to update user suspension', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
