import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { Prisma } from '@prisma/client'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { id: studentId } = await params

    const emergencyContactName =
      body.emergencyContactName !== undefined
        ? String(body.emergencyContactName || '').trim() || null
        : undefined

    const emergencyContactPhone =
      body.emergencyContactPhone !== undefined
        ? String(body.emergencyContactPhone || '').trim() || null
        : undefined

    if (emergencyContactPhone === undefined && emergencyContactName === undefined) {
      return NextResponse.json({ error: 'No emergency contact data provided' }, { status: 400 })
    }

    const existingStudent = await prisma.student.findFirst({
      where: {
        id: studentId,
        ...(session.user.schoolId ? { schoolId: session.user.schoolId } : {}),
      },
      select: { id: true },
    })

    if (!existingStudent) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    await prisma.student.update({
      where: { id: studentId },
      data: {
        emergencyContactName,
        emergencyContactPhone,
      } as Prisma.StudentUncheckedUpdateInput,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating emergency contact:', error)
    return NextResponse.json({ error: 'Failed to update emergency contact' }, { status: 500 })
  }
}
