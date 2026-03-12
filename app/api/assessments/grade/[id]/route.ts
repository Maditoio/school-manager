import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertTermEditableById, assertTermEditableByLegacyValues, TermLockedError } from '@/lib/term-utils'
import { calculateGrade } from '@/lib/utils'
import { enqueueAcademicAggregation, processAcademicAggregationEvents } from '@/lib/academic-aggregation'
import { invalidateSchoolAdminCachedStats } from '@/lib/dashboard-cache'

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

    await assertTermEditableById({
      schoolId: studentAssessment.student.schoolId,
      termId: studentAssessment.assessment.term_id,
    })
    await assertTermEditableByLegacyValues({
      schoolId: studentAssessment.student.schoolId,
      termName: studentAssessment.assessment.term,
      academicYear: studentAssessment.assessment.academicYear,
    })

    // Validate score doesn't exceed total marks
    if (parseFloat(score) > studentAssessment.assessment.totalMarks) {
      return NextResponse.json({ 
        error: `Score cannot exceed ${studentAssessment.assessment.totalMarks}` 
      }, { status: 400 })
    }

    const numericScore = parseFloat(score)
    const totalMarks = Number(studentAssessment.assessment.totalMarks)
    const examType = studentAssessment.assessment.type
    const isExamType = examType === 'EXAM'
    let aggregationTermId = studentAssessment.assessment.term_id

    if (!aggregationTermId) {
      const resolvedTerm = await prisma.terms.findFirst({
        where: {
          school_id: studentAssessment.student.schoolId,
          name: studentAssessment.assessment.term,
          academic_years: {
            is: {
              year: studentAssessment.assessment.academicYear,
            },
          },
        },
        select: { id: true },
      })
      aggregationTermId = resolvedTerm?.id || null
    }

    const updated = await prisma.studentAssessment.update({
      where: { id },
      data: {
        score: numericScore,
        feedback: feedback || null,
        graded: true,
        gradedAt: new Date(),
        submittedAt: studentAssessment.submittedAt || new Date()
      }
    })

    const computedGrade = calculateGrade(numericScore, totalMarks)

    await prisma.result.upsert({
      where: {
        studentId_subjectId_term_year: {
          studentId: studentAssessment.studentId,
          subjectId: studentAssessment.assessment.subjectId,
          term: studentAssessment.assessment.term,
          year: studentAssessment.assessment.academicYear,
        },
      },
      update: {
        term_id: aggregationTermId,
        examType,
        testScore: isExamType ? null : numericScore,
        examScore: isExamType ? numericScore : null,
        totalScore: numericScore,
        maxScore: totalMarks,
        grade: computedGrade,
        comment: feedback || null,
      },
      create: {
        schoolId: studentAssessment.student.schoolId,
        studentId: studentAssessment.studentId,
        subjectId: studentAssessment.assessment.subjectId,
        term_id: aggregationTermId,
        term: studentAssessment.assessment.term,
        year: studentAssessment.assessment.academicYear,
        examType,
        testScore: isExamType ? null : numericScore,
        examScore: isExamType ? numericScore : null,
        totalScore: numericScore,
        maxScore: totalMarks,
        grade: computedGrade,
        comment: feedback || null,
        published: false,
      },
    })

    await enqueueAcademicAggregation({
      schoolId: studentAssessment.student.schoolId,
      termId: aggregationTermId,
    })
    void processAcademicAggregationEvents(1)
    invalidateSchoolAdminCachedStats(studentAssessment.student.schoolId)

    return NextResponse.json({ studentAssessment: updated })
  } catch (error) {
    console.error('Error grading assessment:', error)
    if (error instanceof TermLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to grade assessment' }, { status: 500 })
  }
}
