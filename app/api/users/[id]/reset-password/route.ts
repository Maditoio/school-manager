import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { hash } from 'bcryptjs'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: userId } = await params
    const body = await request.json()
    const newPassword = String(body.newPassword || '')

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        schoolId: true,
        role: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!['TEACHER', 'PARENT'].includes(targetUser.role)) {
      return NextResponse.json({ error: 'Only teacher and parent passwords can be reset here' }, { status: 400 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      if (!session.user.schoolId || targetUser.schoolId !== session.user.schoolId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const hashedPassword = await hash(newPassword, 12)

    await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        password: hashedPassword,
      },
    })

    await prisma.$executeRaw`
      UPDATE users
      SET must_reset_password = true
      WHERE id = ${targetUser.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting user password:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
