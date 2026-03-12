import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { CurrentTermNotSetError, getCurrentEditableTermForSchool, TermLockedError } from '@/lib/term-utils'

type AssessmentDelegate = {
  findMany: (args: unknown) => Promise<unknown>
  create: (args: unknown) => Promise<unknown>
}

type StudentAssessmentDelegate = {
  createMany: (args: unknown) => Promise<unknown>
}

const db = prisma as unknown as {
  assessment?: AssessmentDelegate
  studentAssessment?: StudentAssessmentDelegate
}

// GET all assessments for a teacher/class
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const subjectId = searchParams.get('subjectId')
    const studentId = searchParams.get('studentId')

    const where: Record<string, unknown> = {
      schoolId: session.user.schoolId,
    }

    if (classId) where.classId = classId
    if (subjectId) where.subjectId = subjectId

    if (session.user.role === 'TEACHER') {
      where.teacherId = session.user.id
    }

    if (studentId) {
      where.studentAssessments = {
        some: {
          studentId,
        },
      }
    }

    if (!db.assessment) {
      return NextResponse.json(
        { error: 'Assessment model is unavailable in Prisma Client. Restart dev server and run prisma generate.' },
        { status: 500 }
      )
    }

    const assessments = await db.assessment.findMany({
      where,
      include: {
        subject: true,
        _count: {
          select: { studentAssessments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ assessments })
  } catch (error) {
    console.error('Error fetching assessments:', error)
    return NextResponse.json({ error: 'Failed to fetch assessments' }, { status: 500 })
  }
}

// POST create a new assessment
export async function POST(request: NextRequest) {
  try {
        if (!db.assessment || !db.studentAssessment) {
          return NextResponse.json(
            { error: 'Assessment models are unavailable in Prisma Client. Restart dev server and run prisma generate.' },
            { status: 500 }
          )
        }

    const session = await auth()
    if (!session?.user || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, type, totalMarks, classId, subjectId, dueDate } = body

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    if (!title || !type || !totalMarks || !classId || !subjectId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const currentTerm = await getCurrentEditableTermForSchool(session.user.schoolId)
    const resolvedAcademicYear = currentTerm.academicYear.year
    const resolvedTerm = currentTerm.name

    const parsedTotalMarks = Number(totalMarks)
    if (!Number.isFinite(parsedTotalMarks) || parsedTotalMarks <= 0) {
      return NextResponse.json({ error: 'Total marks must be greater than 0' }, { status: 400 })
    }

    if (dueDate && Number.isNaN(Date.parse(dueDate))) {
      return NextResponse.json({ error: 'Invalid due date format' }, { status: 400 })
    }

    const teacherAssignment = await prisma.classSubjectTeacher.findFirst({
      where: {
        classId,
        subjectId,
        teacherId: session.user.id,
        schoolId: session.user.schoolId
      }
    })

    if (!teacherAssignment) {
      return NextResponse.json({ error: 'Teacher is not assigned to this subject for the selected class' }, { status: 403 })
    }

    const assessment = await db.assessment.create({
      data: {
        title,
        description,
        type,
        totalMarks: parsedTotalMarks,
        classId,
        subjectId,
        term_id: currentTerm.id,
        academicYear: resolvedAcademicYear,
        term: resolvedTerm,
        dueDate: dueDate ? new Date(dueDate) : null,
        schoolId: session.user.schoolId,
        teacherId: session.user.id,
        published: true
      },
      include: {
        subject: true
      }
    })

    // Create StudentAssessment records for all students enrolled in the class
    const classStudents = await prisma.student.findMany({
      where: {
        classId,
        schoolId: session.user.schoolId,
      },
      select: {
        id: true,
      },
    })

    const studentIds = classStudents.map((item) => item.id)

    if (studentIds.length > 0) {
      await db.studentAssessment.createMany({
        data: studentIds.map(studentId => ({
          assessmentId: (assessment as { id: string }).id,
          studentId
        }))
      })
    }

    return NextResponse.json({ assessment }, { status: 201 })
  } catch (error) {
    console.error('Error creating assessment:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: `Database error: ${error.code}` },
        { status: 400 }
      )
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: `Validation error: ${error.message}` },
        { status: 400 }
      )
    }
    if (error instanceof CurrentTermNotSetError || error instanceof TermLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: 'Failed to create assessment' }, { status: 500 })
  }
}
