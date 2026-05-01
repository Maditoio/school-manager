import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
      const { id } = await params
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { suspended, suspensionReason } = body

    if (typeof suspended !== 'boolean') {
      return NextResponse.json({ error: 'The suspended field is required and must be a boolean' }, { status: 400 })
    }

    if (suspended && (!suspensionReason || suspensionReason.trim().length === 0)) {
      return NextResponse.json({ error: 'Suspension reason is required when suspending a school' }, { status: 400 })
    }

    // Verify school exists
    const school = await prisma.school.findUnique({
      where: { id },
      select: { id: true, name: true },
    })

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }

    // Update school suspension status
    const updatedSchool = await prisma.school.update({
      where: { id },
      data: {
        suspended,
        suspensionReason: suspended ? suspensionReason.trim() : null,
        suspendedAt: suspended ? new Date() : null,
      },
      select: {
        id: true,
        name: true,
        suspended: true,
        suspensionReason: true,
        suspendedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      school: updatedSchool,
      message: suspended
        ? `School "${school.name}" has been suspended.`
        : `School "${school.name}" has been unsuspended.`,
    })
  } catch (error) {
    console.error('Error updating school suspension status:', error)
    return NextResponse.json({ error: 'Failed to update school suspension status' }, { status: 500 })
  }
}
