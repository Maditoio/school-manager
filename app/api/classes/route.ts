import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createClassSchema } from "@/lib/validations"
import { hasRole } from "@/lib/auth-utils"

// GET /api/classes - Get classes
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const where: Record<string, unknown> = {}

    // Filter by school for non-super admins
    if (session.user.schoolId) {
      where.schoolId = session.user.schoolId
    }

    // For teachers, show all classes where they teach at least one subject
    if (session.user.role === 'TEACHER') {
      const assignedRows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT DISTINCT c.id
        FROM classes c
        LEFT JOIN class_subject_teachers cst ON cst.class_id = c.id
        WHERE c.school_id = ${session.user.schoolId}
          AND (
            c.teacher_id = ${session.user.id}
            OR cst.teacher_id = ${session.user.id}
          )
      `

      const classIds = assignedRows.map((row) => row.id)
      if (classIds.length === 0) {
        return NextResponse.json({ classes: [] })
      }

      where.id = { in: classIds }
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ classes })
  } catch (error) {
    console.error('Error fetching classes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch classes' },
      { status: 500 }
    )
  }
}

// POST /api/classes - Create class
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createClassSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { name, academicYear, teacherId, grade } = validation.data

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'School ID required' },
        { status: 400 }
      )
    }

    const classData = await prisma.class.create({
      data: {
        schoolId: session.user.schoolId,
        name,
        academicYear,
        teacherId,
        grade,
      },
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json({ class: classData }, { status: 201 })
  } catch (error) {
    console.error('Error creating class:', error)
    return NextResponse.json(
      { error: 'Failed to create class' },
      { status: 500 }
    )
  }
}
