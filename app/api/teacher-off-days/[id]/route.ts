import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { invalidateSchoolAdminCachedStats } from '@/lib/dashboard-cache'
import { Prisma } from '@prisma/client'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const offDay = await prisma.teacherOffDay.findUnique({
      where: { id },
      select: {
        id: true,
        schoolId: true,
        teacherId: true,
      },
    })

    if (!offDay) {
      return NextResponse.json({ error: 'Off-day booking not found' }, { status: 404 })
    }

    if (session.user.schoolId && offDay.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (session.user.role === 'TEACHER' && offDay.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.teacherOffDay.delete({
      where: { id },
    })

    invalidateSchoolAdminCachedStats(offDay.schoolId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting teacher off-day:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2021') {
        return NextResponse.json(
          { error: 'Teacher off-day table is missing. Run database migrations and retry.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ error: 'Failed to delete teacher off-day' }, { status: 500 })
  }
}
