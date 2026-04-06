import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createClassSchema } from "@/lib/validations"
import { hasRole } from "@/lib/auth-utils"
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

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

    // For teachers, enrich with the subjects they teach in each class
    if (session.user.role === 'TEACHER' && classes.length > 0) {
      const assignments = await prisma.classSubjectTeacher.findMany({
        where: {
          teacherId: session.user.id,
          classId: { in: classes.map((c) => c.id) },
          ...(session.user.schoolId ? { schoolId: session.user.schoolId } : {}),
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: { subject: { name: 'asc' } },
      })

      const subjectMap = new Map<string, Array<{ id: string; name: string; code: string | null }>>()
      for (const a of assignments) {
        if (!subjectMap.has(a.classId)) subjectMap.set(a.classId, [])
        subjectMap.get(a.classId)!.push(a.subject)
      }

      const enrichedClasses = classes.map((c) => ({ ...c, subjects: subjectMap.get(c.id) ?? [] }))
      return NextResponse.json({ classes: enrichedClasses })
    }

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

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const normalizedBody = {
      ...body,
      name: typeof body.name === 'string' ? body.name.trim() : body.name,
      academicYear: body.academicYear,
      teacherId:
        typeof body.teacherId === 'string' && body.teacherId.trim() === ''
          ? undefined
          : body.teacherId,
      capacity:
        body.capacity === '' || body.capacity === null || body.capacity === undefined
          ? undefined
          : body.capacity,
    }
    const validation = createClassSchema.safeParse(normalizedBody)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { name, academicYear, teacherId, grade, capacity } = validation.data

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'School ID required' },
        { status: 400 }
      )
    }

    const classId = randomUUID()

    await prisma.$executeRaw`
      INSERT INTO classes (
        id,
        school_id,
        name,
        academic_year,
        teacher_id,
        grade,
        capacity,
        created_at,
        updated_at
      ) VALUES (
        ${classId},
        ${session.user.schoolId},
        ${name},
        ${academicYear},
        ${teacherId ?? null},
        ${grade ?? null},
        ${capacity ?? null},
        NOW(),
        NOW()
      )
    `

    const classData = await prisma.class.findUnique({
      where: { id: classId },
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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A class with this name already exists for this academic year.' },
          { status: 409 }
        )
      }

      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: 'Selected teacher is invalid for this school.' },
          { status: 400 }
        )
      }
    }

    const details =
      process.env.NODE_ENV !== 'production' && error instanceof Error
        ? error.message
        : undefined
    return NextResponse.json(
      { error: 'Failed to create class', details },
      { status: 500 }
    )
  }
}
