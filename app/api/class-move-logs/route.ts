import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const take = Math.min(Number(searchParams.get('take') || 200), 500)

    const logs = await prisma.studentClassHistory.findMany({
      where: session.user.schoolId
        ? {
            student: {
              schoolId: session.user.schoolId,
            },
          }
        : undefined,
      select: {
        id: true,
        studentId: true,
        fromClassId: true,
        toClassId: true,
        reason: true,
        effectiveAt: true,
        createdAt: true,
        student: {
          select: {
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
        fromClass: {
          select: {
            name: true,
          },
        },
        toClass: {
          select: {
            name: true,
          },
        },
        changedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take,
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Error fetching class move logs:', error)
    return NextResponse.json({ error: 'Failed to fetch class move logs' }, { status: 500 })
  }
}
