import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { teacherCanAccessClass } from '@/lib/teacher-class-access'
import { CurrentTermNotSetError, getCurrentTermForSchool } from '@/lib/term-utils'

type AssessmentTypeFilter = 'QUIZ' | 'TEST' | 'EXAM' | 'ASSIGNMENT'

const DEFAULT_TYPES: AssessmentTypeFilter[] = ['QUIZ', 'EXAM', 'ASSIGNMENT']

function parseTypes(raw: string | null): AssessmentTypeFilter[] {
  if (!raw) return DEFAULT_TYPES
  const allowed = new Set(['QUIZ', 'TEST', 'EXAM', 'ASSIGNMENT'])
  const parts = raw
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter((part): part is AssessmentTypeFilter => allowed.has(part))
  return parts.length > 0 ? parts : DEFAULT_TYPES
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'TEACHER' || !session.user.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schoolId = session.user.schoolId
    const teacherId = session.user.id
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const studentId = searchParams.get('studentId') || undefined
    const types = parseTypes(searchParams.get('types'))

    if (!classId) {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 })
    }

    const canAccess = await teacherCanAccessClass(teacherId, schoolId, classId)
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let academicYear: number
    try {
      const currentTerm = await getCurrentTermForSchool(schoolId)
      academicYear = currentTerm.academicYear.year
    } catch (error) {
      if (error instanceof CurrentTermNotSetError) {
        return NextResponse.json({
          academicYear: null,
          classId,
          studentId: studentId || null,
          points: [],
          byType: { QUIZ: [], TEST: [], EXAM: [], ASSIGNMENT: [] },
          typeAverages: { QUIZ: null, TEST: null, EXAM: null, ASSIGNMENT: null },
          overallAverage: null,
          message: 'No current term configured',
        })
      }
      throw error
    }

    if (studentId) {
      const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId, classId },
        select: { id: true, firstName: true, lastName: true },
      })
      if (!student) {
        return NextResponse.json({ error: 'Student not found in this class' }, { status: 404 })
      }
    }

    const taughtSubjects = await prisma.classSubjectTeacher.findMany({
      where: { schoolId, teacherId, classId },
      select: { subjectId: true },
    })
    const subjectIds = taughtSubjects.map((row) => row.subjectId)

    const assessments = await prisma.assessment.findMany({
      where: {
        schoolId,
        classId,
        academicYear,
        type: { in: types },
        published: true,
        OR: [
          { teacherId },
          ...(subjectIds.length > 0 ? [{ subjectId: { in: subjectIds } }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        totalMarks: true,
        dueDate: true,
        createdAt: true,
        studentAssessments: {
          where: {
            graded: true,
            score: { not: null },
            ...(studentId ? { studentId } : {}),
          },
          select: {
            score: true,
            studentId: true,
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    })

    const points = assessments
      .map((assessment) => {
        const scores = assessment.studentAssessments
          .map((row) => {
            const max = assessment.totalMarks || 1
            return ((row.score || 0) / max) * 100
          })
          .filter((value) => Number.isFinite(value))

        if (scores.length === 0) return null

        const average =
          scores.reduce((sum, value) => sum + value, 0) / scores.length

        return {
          assessmentId: assessment.id,
          title: assessment.title,
          type: assessment.type as AssessmentTypeFilter,
          date: (assessment.dueDate || assessment.createdAt).toISOString(),
          percent: Math.round(average * 10) / 10,
          sampleSize: scores.length,
        }
      })
      .filter((point): point is NonNullable<typeof point> => point !== null)

    const byType: Record<AssessmentTypeFilter, typeof points> = {
      QUIZ: [],
      TEST: [],
      EXAM: [],
      ASSIGNMENT: [],
    }
    for (const point of points) {
      byType[point.type].push(point)
    }

    const typeAverages: Record<AssessmentTypeFilter, number | null> = {
      QUIZ: null,
      TEST: null,
      EXAM: null,
      ASSIGNMENT: null,
    }
    for (const type of Object.keys(byType) as AssessmentTypeFilter[]) {
      const series = byType[type]
      if (series.length === 0) continue
      typeAverages[type] =
        Math.round(
          (series.reduce((sum, point) => sum + point.percent, 0) / series.length) * 10
        ) / 10
    }

    const overallAverage =
      points.length > 0
        ? Math.round(
            (points.reduce((sum, point) => sum + point.percent, 0) / points.length) * 10
          ) / 10
        : null

    const classRow = await prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { name: true },
    })

    return NextResponse.json({
      academicYear,
      classId,
      className: classRow?.name || null,
      studentId: studentId || null,
      points,
      byType,
      typeAverages,
      overallAverage,
      types,
    })
  } catch (error) {
    console.error('Teacher performance trends error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
