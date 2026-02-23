import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { compare, hash } from 'bcryptjs'

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const currentPassword = String(body.currentPassword || '')
    const newPassword = String(body.newPassword || '')

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isLegacyPassword = !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$') && !user.password.startsWith('$2y$')

    if (!session.user.mustResetPassword) {
      const isCurrentValid = isLegacyPassword
        ? user.password === currentPassword
        : await compare(currentPassword, user.password)

      if (!isCurrentValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }
    }

    const hashedNewPassword = await hash(newPassword, 12)

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: hashedNewPassword,
      },
    })

    await prisma.$executeRaw`
      UPDATE users
      SET must_reset_password = false
      WHERE id = ${session.user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating own password:', error)
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }
}
