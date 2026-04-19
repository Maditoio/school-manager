import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: classId } = await context.params

    const classData = await prisma.class.findFirst({
      where: {
        id: classId,
        ...(session.user.schoolId ? { schoolId: session.user.schoolId } : {}),
      },
      select: { id: true, schoolId: true, academicYear: true },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    const assignments = await prisma.classSubjectTeacher.findMany({
      where: {
        classId,
        schoolId: classData.schoolId,
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        subject: {
          name: 'asc',
        },
      },
    })

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Error fetching class subject assignments:', error)
    return NextResponse.json({ error: 'Failed to fetch class subject assignments' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: classId } = await context.params
    const body = await request.json()

    const subjectIds = Array.isArray(body.subjectIds)
      ? body.subjectIds.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : typeof body.subjectId === 'string' && body.subjectId.trim().length > 0
        ? [body.subjectId]
        : []
    const teacherId = typeof body.teacherId === 'string' ? body.teacherId : ''

    if (subjectIds.length === 0 || !teacherId) {
      return NextResponse.json({ error: 'subjectIds and teacherId are required' }, { status: 400 })
    }

    const classData = await prisma.class.findFirst({
      where: {
        id: classId,
        ...(session.user.schoolId ? { schoolId: session.user.schoolId } : {}),
      },
      select: { id: true, schoolId: true },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    const [subjects, teacher] = await Promise.all([
      prisma.subject.findMany({
        where: {
          id: { in: subjectIds },
          schoolId: classData.schoolId,
        },
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: {
          id: teacherId,
          schoolId: classData.schoolId,
          role: 'TEACHER',
        },
        select: { id: true },
      }),
    ])

    if (subjects.length !== subjectIds.length) {
      return NextResponse.json({ error: 'One or more subjects were not found in this school' }, { status: 404 })
    }

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found in this school' }, { status: 404 })
    }

    await prisma.$transaction(
      subjectIds.map((subjectId) =>
        prisma.classSubjectTeacher.upsert({
          where: {
            classId_subjectId: {
              classId,
              subjectId,
            },
          },
          update: {
            teacherId,
          },
          create: {
            schoolId: classData.schoolId,
            classId,
            subjectId,
            teacherId,
          },
        })
      )
    )

    const assignments = await prisma.classSubjectTeacher.findMany({
      where: {
        classId,
        schoolId: classData.schoolId,
        subjectId: { in: subjectIds },
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ assignments, count: assignments.length }, { status: 201 })
  } catch (error) {
    console.error('Error assigning subject teacher to class:', error)
    return NextResponse.json({ error: 'Failed to assign subject teacher to class' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: classId } = await context.params
    const { searchParams } = new URL(request.url)
    const subjectId = searchParams.get('subjectId')

    if (!subjectId) {
      return NextResponse.json({ error: 'subjectId is required' }, { status: 400 })
    }

    const classData = await prisma.class.findFirst({
      where: {
        id: classId,
        ...(session.user.schoolId ? { schoolId: session.user.schoolId } : {}),
      },
      select: { id: true, schoolId: true },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    await prisma.classSubjectTeacher.deleteMany({
      where: {
        schoolId: classData.schoolId,
        classId,
        subjectId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing class subject assignment:', error)
    return NextResponse.json({ error: 'Failed to remove class subject assignment' }, { status: 500 })
  }
}
