import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createClassSchema } from "@/lib/validations"
import { hasRole } from "@/lib/auth-utils"
import { getTeacherAccessibleClassIds } from "@/lib/teacher-class-access"
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

    // Teachers: homeroom ∪ ClassSubjectTeacher assignments
    if (session.user.role === 'TEACHER') {
      if (!session.user.schoolId) {
        return NextResponse.json({ error: 'School context required' }, { status: 400 })
      }

      const classIds = await getTeacherAccessibleClassIds(session.user.id, session.user.schoolId)
      if (classIds.length === 0) {
        return NextResponse.json({ classes: [] })
      }

      where.id = { in: classIds }
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        academicYearRecord: {
          select: {
            id: true,
            year: true,
          },
        },
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

    const normalizedClasses = classes.map((cls) => ({
      ...cls,
      academicYearId: cls.academicYearRecord?.id ?? cls.academicYearId ?? null,
      academicYear: cls.academicYearRecord?.year ?? cls.academicYear,
    }))

    const isAdminRole =
      session.user.role === 'SCHOOL_ADMIN' ||
      session.user.role === 'DEPUTY_ADMIN' ||
      session.user.role === 'SUPER_ADMIN'

    // For admins, enrich with subject teachers grouped by teacher per class
    if (isAdminRole && normalizedClasses.length > 0) {
      const assignments = await prisma.classSubjectTeacher.findMany({
        where: {
          classId: { in: normalizedClasses.map((c) => c.id) },
          ...(session.user.schoolId ? { schoolId: session.user.schoolId } : {}),
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ teacher: { lastName: 'asc' } }, { subject: { name: 'asc' } }],
      })

      const groupsByClass = new Map<
        string,
        Map<
          string,
          {
            teacherId: string
            teacher: { id: string; firstName: string; lastName: string }
            subjects: Array<{ id: string; name: string; code: string | null }>
          }
        >
      >()

      for (const row of assignments) {
        if (!groupsByClass.has(row.classId)) {
          groupsByClass.set(row.classId, new Map())
        }
        const byTeacher = groupsByClass.get(row.classId)!
        if (!byTeacher.has(row.teacherId)) {
          byTeacher.set(row.teacherId, {
            teacherId: row.teacherId,
            teacher: {
              id: row.teacher.id,
              firstName: row.teacher.firstName ?? '',
              lastName: row.teacher.lastName ?? '',
            },
            subjects: [],
          })
        }
        byTeacher.get(row.teacherId)!.subjects.push(row.subject)
      }

      const enrichedClasses = normalizedClasses.map((c) => ({
        ...c,
        teacherSubjectGroups: Array.from(groupsByClass.get(c.id)?.values() ?? []),
      }))

      return NextResponse.json({ classes: enrichedClasses })
    }

    // For teachers, enrich with the subjects they teach in each class
    if (session.user.role === 'TEACHER' && normalizedClasses.length > 0) {
      const assignments = await prisma.classSubjectTeacher.findMany({
        where: {
          teacherId: session.user.id,
          classId: { in: normalizedClasses.map((c) => c.id) },
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

      const enrichedClasses = normalizedClasses.map((c) => ({ ...c, subjects: subjectMap.get(c.id) ?? [] }))
      return NextResponse.json({ classes: enrichedClasses })
    }

    return NextResponse.json({ classes: normalizedClasses })
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
      academicYearId: body.academicYearId,
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

    const { name, academicYearId, teacherId, grade, capacity } = validation.data

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'School ID required' },
        { status: 400 }
      )
    }

    if (!academicYearId) {
      return NextResponse.json(
        { error: 'Academic year is required' },
        { status: 400 }
      )
    }

    const academicYearRecord = await prisma.academic_years.findFirst({
      where: {
        id: academicYearId,
        school_id: session.user.schoolId,
      },
      select: {
        id: true,
        year: true,
      },
    })

    if (!academicYearRecord) {
      return NextResponse.json(
        { error: 'Selected academic year is invalid for this school.' },
        { status: 400 }
      )
    }

    const classId = randomUUID()

    await prisma.class.create({
      data: {
        id: classId,
        schoolId: session.user.schoolId,
        name,
        academicYear: academicYearRecord.year,
        academicYearId: academicYearRecord.id,
        teacherId: teacherId ?? null,
        grade: grade ?? null,
        capacity: capacity ?? null,
      },
    })

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        academicYearRecord: {
          select: {
            id: true,
            year: true,
          },
        },
        teacher: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    const normalizedClassData = classData
      ? {
          ...classData,
          academicYearId: classData.academicYearRecord?.id ?? classData.academicYearId ?? null,
          academicYear: classData.academicYearRecord?.year ?? classData.academicYear,
        }
      : null

    return NextResponse.json({ class: normalizedClassData }, { status: 201 })
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
