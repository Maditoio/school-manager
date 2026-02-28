import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { invalidateSchoolAdminCachedStats } from '@/lib/dashboard-cache'
import { Prisma } from '@prisma/client'

function toUtcDate(value: string) {
  const iso = `${value}T00:00:00.000Z`
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teacherId = searchParams.get('teacherId')
    const activeOn = (searchParams.get('activeOn') || '').trim()

    const where: {
      schoolId?: string
      teacherId?: string
      startDate?: { lte: Date }
      endDate?: { gte: Date }
    } = {}

    if (session.user.schoolId) {
      where.schoolId = session.user.schoolId
    }

    if (session.user.role === 'TEACHER') {
      where.teacherId = session.user.id
    } else if (teacherId) {
      where.teacherId = teacherId
    }

    if (activeOn) {
      const activeDate = toUtcDate(activeOn)
      if (!activeDate) {
        return NextResponse.json({ error: 'Invalid activeOn date. Use YYYY-MM-DD' }, { status: 400 })
      }

      where.startDate = { lte: activeDate }
      where.endDate = { gte: activeDate }
    }

    const offDays = await prisma.teacherOffDay.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ offDays })
  } catch (error) {
    console.error('Error fetching teacher off-days:', error)
    return NextResponse.json({ error: 'Failed to fetch teacher off-days' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const body = await request.json()
    const startDateInput = String(body?.startDate || '').trim()
    const endDateInput = String(body?.endDate || '').trim()
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

    if (!startDateInput || !endDateInput) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }

    const startDate = toUtcDate(startDateInput)
    const endDate = toUtcDate(endDateInput)

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
    }

    if (endDate < startDate) {
      return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 })
    }

    const overlap = await prisma.teacherOffDay.findFirst({
      where: {
        schoolId: session.user.schoolId,
        teacherId: session.user.id,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    })

    if (overlap) {
      return NextResponse.json({ error: 'An existing off-day booking overlaps this date range' }, { status: 409 })
    }

    const offDay = await prisma.teacherOffDay.create({
      data: {
        schoolId: session.user.schoolId,
        teacherId: session.user.id,
        startDate,
        endDate,
        reason: reason || null,
      },
    })

    invalidateSchoolAdminCachedStats(session.user.schoolId)

    return NextResponse.json({ offDay }, { status: 201 })
  } catch (error) {
    console.error('Error creating teacher off-day:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'This off-day booking already exists.' },
          { status: 409 }
        )
      }

      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: 'Invalid teacher reference. Please sign out and sign in again.' },
          { status: 400 }
        )
      }

      if (error.code === 'P2021') {
        return NextResponse.json(
          { error: 'Teacher off-day table is missing. Run database migrations and retry.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ error: 'Failed to create teacher off-day' }, { status: 500 })
  }
}
