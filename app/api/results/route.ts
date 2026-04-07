import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resultSchema } from "@/lib/validations"
import { hasRole } from "@/lib/auth-utils"
import { calculateGrade } from "@/lib/utils"
import { Prisma } from "@prisma/client"
import { CurrentTermNotSetError, getCurrentEditableTermForSchool, TermLockedError } from '@/lib/term-utils'
import { enqueueAcademicAggregation, processAcademicAggregationEvents } from '@/lib/academic-aggregation'
import { invalidateSchoolAdminCachedStats } from '@/lib/dashboard-cache'

// GET /api/results - Get results
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role === 'TEACHER') {
      return NextResponse.json(
        {
          error: 'Legacy teacher results endpoint is retired. Use /api/assessment-results instead.',
        },
        { status: 410 }
      )
    }

    if (session.user.role === 'PARENT') {
      return NextResponse.json(
        {
          error: 'Legacy parent results endpoint is retired. Use /api/students/assessments instead.',
        },
        { status: 410 }
      )
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const term = searchParams.get('term')
    const year = searchParams.get('year')

    const where: Record<string, unknown> = {}

    // Filter by school for non-super admins
    if (session.user.schoolId) {
      where.schoolId = session.user.schoolId
    }

    // Filter by student
    if (studentId) {
      where.studentId = studentId
    }

    // Filter by term
    if (term) {
      where.term = term
    }

    // Filter by year
    if (year) {
      where.year = parseInt(year)
    }

    const results = await prisma.result.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        subject: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        { year: 'desc' },
        { term: 'desc' },
      ],
    })

    // Transform results to include computed score field
    const transformedResults = results.map((result) => ({
      ...result,
      score: result.examType === 'FINAL' ? result.examScore : result.testScore,
    }))

    return NextResponse.json({ results: transformedResults })
  } catch (error) {
    console.error('Error fetching results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    )
  }
}

// POST /api/results - Add results
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['TEACHER', 'SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role === 'TEACHER') {
      return NextResponse.json(
        {
          error: 'Legacy teacher results creation is retired. Create assessments and grade students in /teacher/assessments.',
        },
        { status: 410 }
      )
    }

    const body = await request.json()
    const validation = resultSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { 
      studentId, 
      subjectId, 
      examType, 
      score, 
      maxScore, 
      grade, 
      comment 
    } = validation.data

    // Verify student belongs to school
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    if (session.user.schoolId && student.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    })

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
    }

    if (session.user.schoolId && subject.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const currentTerm = await getCurrentEditableTermForSchool(student.schoolId)
    const term = currentTerm.name
    const year = currentTerm.academicYear.year

    // Map examType to appropriate field and calculate total score
    const testScore = examType === 'QUIZ' || examType === 'ASSIGNMENT' ? score : examType === 'MIDTERM' ? score : undefined
    const examScore = examType === 'FINAL' ? score : undefined
    const totalScore = (testScore || 0) + (examScore || 0)
    
    // Auto-calculate grade if not provided
    const finalGrade = grade || calculateGrade(totalScore, maxScore)

    // Upsert result
    const result = await prisma.result.upsert({
      where: {
        studentId_subjectId_term_year: {
          studentId,
          subjectId,
          term,
          year,
        },
      },
      update: {
        termId: currentTerm.id,
        examType,
        testScore,
        examScore,
        totalScore,
        maxScore,
        grade: finalGrade,
        comment,
      },
      create: {
        schoolId: student.schoolId,
        studentId,
        subjectId,
        termId: currentTerm.id,
        term,
        year,
        examType,
        testScore,
        examScore,
        totalScore,
        maxScore,
        grade: finalGrade,
        comment,
        published: false,
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        subject: {
          select: {
            name: true,
          },
        },
      },
    })

    await enqueueAcademicAggregation({
      schoolId: student.schoolId,
      termId: currentTerm.id,
    })
    void processAcademicAggregationEvents(1)
    invalidateSchoolAdminCachedStats(student.schoolId)

    return NextResponse.json({ result }, { status: 201 })
  } catch (error) {
    console.error('Error adding result:', error)
    if (error instanceof CurrentTermNotSetError || error instanceof TermLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const details =
      process.env.NODE_ENV !== 'production' && error instanceof Error
        ? error.message
        : undefined
    const code =
      error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined
    return NextResponse.json(
      { error: 'Failed to add result', details, code },
      { status: 500 }
    )
  }
}
