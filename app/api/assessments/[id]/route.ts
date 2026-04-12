import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertTermEditableById, assertTermEditableByLegacyValues, TermLockedError } from '@/lib/term-utils'

// GET a single assessment with student grades
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const assessment = await prisma.assessment.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
        ...(session.user.role === 'TEACHER' ? { teacherId: session.user.id } : {}),
      },
      include: {
        subject: true,
        studentAssessments: {
          select: {
            id: true,
            studentId: true,
            score: true,
            feedback: true,
            graded: true,
            gradedAt: true,
            startedAt: true,
            submittedAt: true,
            createdAt: true,
            updatedAt: true,
          }
        }
      }
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    const classStudents = await prisma.student.findMany({
      where: {
        classId: assessment.classId,
        schoolId: session.user.schoolId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    const classStudentIds = classStudents.map((student) => student.id)
    const existingStudentIds = new Set(assessment.studentAssessments.map((row) => row.studentId))

    const missingStudentIds = classStudentIds.filter((studentId) => !existingStudentIds.has(studentId))

    if (missingStudentIds.length > 0) {
      await prisma.studentAssessment.createMany({
        data: missingStudentIds.map((studentId) => ({
          assessmentId: assessment.id,
          studentId,
        })),
        skipDuplicates: true,
      })
    }

    const scopedStudentAssessments = classStudentIds.length > 0
      ? await prisma.studentAssessment.findMany({
          where: {
            assessmentId: assessment.id,
            studentId: { in: classStudentIds },
          },
          select: {
            id: true,
            studentId: true,
            score: true,
            feedback: true,
            graded: true,
            gradedAt: true,
            startedAt: true,
            submittedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : []

    const studentMap = new Map(classStudents.map((student) => [student.id, student]))

    const enrichedStudentAssessments = scopedStudentAssessments
      .map((studentAssessment) => ({
        ...studentAssessment,
        student: studentMap.get(studentAssessment.studentId) ?? {
          id: studentAssessment.studentId,
          firstName: 'Unknown',
          lastName: 'Student',
          admissionNumber: null,
        },
      }))
      .sort((a, b) => {
        const aName = `${a.student.firstName ?? ''} ${a.student.lastName ?? ''}`.trim().toLowerCase()
        const bName = `${b.student.firstName ?? ''} ${b.student.lastName ?? ''}`.trim().toLowerCase()
        return aName.localeCompare(bName)
      })

    return NextResponse.json({
      assessment: {
        ...assessment,
        studentAssessments: enrichedStudentAssessments,
      },
    })
  } catch (error) {
    console.error('Error fetching assessment:', error)
    return NextResponse.json({ error: 'Failed to fetch assessment' }, { status: 500 })
  }
}

// PUT update an assessment
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await auth()
    if (!session?.user || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { title, description, type, totalMarks, dueDate, published } = body

    // Verify ownership
    const existing = await prisma.assessment.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
        teacherId: session.user.id
      },
      select: {
        id: true,
        terms: {
          select: {
            id: true,
          },
        },
        term: true,
        academicYear: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Assessment not found or unauthorized' }, { status: 404 })
    }

    await assertTermEditableById({ schoolId: session.user.schoolId, termId: existing.terms?.id })
    await assertTermEditableByLegacyValues({
      schoolId: session.user.schoolId,
      termName: existing.term,
      academicYear: existing.academicYear,
    })

    const assessment = await prisma.assessment.update({
      where: { id },
      data: {
        title,
        description,
        type,
        totalMarks: totalMarks ? parseFloat(totalMarks) : undefined,
        dueDate: dueDate ? new Date(dueDate) : null,
        published: typeof published === 'boolean' ? published : undefined,
      },
      include: {
        subject: true
      }
    })

    return NextResponse.json({ assessment })
  } catch (error) {
    console.error('Error updating assessment:', error)
    if (error instanceof TermLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to update assessment' }, { status: 500 })
  }
}

// DELETE an assessment
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await auth()
    if (!session?.user || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.assessment.findFirst({
      where: {
        id,
        schoolId: session.user.schoolId,
        teacherId: session.user.id
      },
      select: {
        id: true,
        terms: {
          select: {
            id: true,
          },
        },
        term: true,
        academicYear: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Assessment not found or unauthorized' }, { status: 404 })
    }

    await assertTermEditableById({ schoolId: session.user.schoolId, termId: existing.terms?.id })
    await assertTermEditableByLegacyValues({
      schoolId: session.user.schoolId,
      termName: existing.term,
      academicYear: existing.academicYear,
    })

    await prisma.assessment.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Assessment deleted successfully' })
  } catch (error) {
    console.error('Error deleting assessment:', error)
    if (error instanceof TermLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to delete assessment' }, { status: 500 })
  }
}
