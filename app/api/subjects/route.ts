import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSubjectSchema } from "@/lib/validations"
import { hasRole } from "@/lib/auth-utils"

// GET /api/subjects - Get subjects
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')

    if (classId) {
      const assignments = await prisma.classSubjectTeacher.findMany({
        where: {
          classId,
          ...(session.user.schoolId ? { schoolId: session.user.schoolId } : {}),
          ...(session.user.role === 'TEACHER' ? { teacherId: session.user.id } : {}),
        },
        include: {
          subject: true,
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          subject: {
            name: 'asc',
          },
        },
      })

      return NextResponse.json({
        subjects: assignments.map((assignment) => ({
          ...assignment.subject,
          assignedTeacher: assignment.teacher,
        })),
      })
    }

    const where: Record<string, unknown> = {}

    // Filter by school for non-super admins
    if (session.user.schoolId) {
      where.schoolId = session.user.schoolId
    }

    const subjects = await prisma.subject.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ subjects })
  } catch (error) {
    console.error('Error fetching subjects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subjects' },
      { status: 500 }
    )
  }
}

// POST /api/subjects - Create subject
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createSubjectSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { name, code, passRate } = validation.data

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'School ID required' },
        { status: 400 }
      )
    }

    const subject = await prisma.subject.create({
      data: {
        schoolId: session.user.schoolId,
        name,
        code,
        passRate: passRate ?? null,
      },
    })

    return NextResponse.json({ subject }, { status: 201 })
  } catch (error) {
    console.error('Error creating subject:', error)
    return NextResponse.json(
      { error: 'Failed to create subject' },
      { status: 500 }
    )
  }
}
