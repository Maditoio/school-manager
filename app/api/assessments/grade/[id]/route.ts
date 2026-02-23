import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT/PATCH grade a student assessment
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

    const body = await request.json()
    const { score, feedback } = body

    if (score === undefined || score === null) {
      return NextResponse.json({ error: 'Score is required' }, { status: 400 })
    }

    // Verify the teacher owns this assessment
    const studentAssessment = await prisma.studentAssessment.findFirst({
      where: {
        id
      },
      include: {
        assessment: true,
        student: {
          select: {
            id: true,
            classId: true,
            schoolId: true,
          },
        },
      }
    })

    if (!studentAssessment) {
      return NextResponse.json({ error: 'Student assessment not found' }, { status: 404 })
    }

    if (studentAssessment.student.classId !== studentAssessment.assessment.classId) {
      return NextResponse.json({ error: 'Student is not in this assessment class' }, { status: 400 })
    }

    const teacherAssignment = await prisma.classSubjectTeacher.findFirst({
      where: {
        schoolId: studentAssessment.student.schoolId,
        classId: studentAssessment.assessment.classId,
        subjectId: studentAssessment.assessment.subjectId,
        teacherId: session.user.id,
      },
      select: { id: true },
    })

    if (!teacherAssignment || studentAssessment.assessment.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized to grade this assessment' }, { status: 403 })
    }

    // Validate score doesn't exceed total marks
    if (parseFloat(score) > studentAssessment.assessment.totalMarks) {
      return NextResponse.json({ 
        error: `Score cannot exceed ${studentAssessment.assessment.totalMarks}` 
      }, { status: 400 })
    }

    const updated = await prisma.studentAssessment.update({
      where: { id },
      data: {
        score: parseFloat(score),
        feedback: feedback || null,
        graded: true,
        gradedAt: new Date(),
        submittedAt: studentAssessment.submittedAt || new Date()
      }
    })

    return NextResponse.json({ studentAssessment: updated })
  } catch (error) {
    console.error('Error grading assessment:', error)
    return NextResponse.json({ error: 'Failed to grade assessment' }, { status: 500 })
  }
}
