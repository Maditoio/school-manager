import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getStudentFeeAccessStatus } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/reports/student
 * Query params:
 *   studentId  (required)
 *   termId     (optional – if omitted, returns all-term/final-year view)
 *   academicYearId (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = session.user.role
    if (!['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const termId = searchParams.get('termId')
    const academicYearId = searchParams.get('academicYearId')

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
    }

    const accessStatus = await getStudentFeeAccessStatus(studentId)
    if (accessStatus.blocked) {
      return NextResponse.json(
        { error: accessStatus.reason || 'Student report generation is blocked until license coverage is restored.' },
        { status: 403 }
      )
    }

    const schoolId = session.user.schoolId

    // ── 1. Student + class + form teacher ──────────────────────────────
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        ...(schoolId ? { schoolId } : {}),
      },
      include: {
        class: {
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                title: true,
              },
            },
          },
        },
        school: {
          select: { id: true, name: true },
        },
      },
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // ── 2. Term info ────────────────────────────────────────────────────
    let termInfo: {
      id: string
      name: string
      startDate: Date
      endDate: Date
      academicYearId: string
      academicYearName: string
      academicYear: number
    } | null = null

    if (termId) {
      const term = await prisma.terms.findFirst({
        where: { id: termId, school_id: student.schoolId },
        include: { academic_years: true },
      })
      if (term) {
        termInfo = {
          id: term.id,
          name: term.name,
          startDate: term.start_date,
          endDate: term.end_date,
          academicYearId: term.academic_year_id,
          academicYearName: term.academic_years.name,
          academicYear: term.academic_years.year,
        }
      }
    }

    // ── 3. Results for this student (filtered by term if provided) ──────
    const resultsWhere: Record<string, unknown> = {
      studentId,
      ...(schoolId ? { schoolId } : {}),
    }
    if (termId) {
      resultsWhere.termId = termId
    } else if (academicYearId) {
      // All terms in that academic year
      const termsInYear = await prisma.terms.findMany({
        where: { academic_year_id: academicYearId, school_id: student.schoolId },
        select: { id: true },
      })
      resultsWhere.termId = { in: termsInYear.map(t => t.id) }
    }

    const results = await prisma.result.findMany({
      where: resultsWhere,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        terms: { include: { academic_years: true } },
      },
      orderBy: [{ year: 'asc' }, { term: 'asc' }],
    })

    // ── 4. Assessment-based scores (StudentAssessment) ──────────────────
    // Group assessments by subject for this student within the term
    const assessmentWhere: Record<string, unknown> = {
      studentId,
      assessment: {
        schoolId: student.schoolId,
        ...(termId ? { termId } : {}),
        ...(academicYearId && !termId
          ? {
              termId: {
                in: (
                  await prisma.terms.findMany({
                    where: { academic_year_id: academicYearId, school_id: student.schoolId },
                    select: { id: true },
                  })
                ).map(t => t.id),
              },
            }
          : {}),
      },
    }

    const studentAssessments = await prisma.studentAssessment.findMany({
      where: assessmentWhere,
      include: {
        assessment: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            teacher: { select: { id: true, firstName: true, lastName: true, title: true } },
          },
        },
      },
    })

    // ── 5. Attendance for the term ──────────────────────────────────────
    const attendanceWhere: Record<string, unknown> = {
      studentId,
      ...(schoolId ? { schoolId } : {}),
    }
    if (termId) {
      attendanceWhere.termId = termId
    } else if (termInfo) {
      attendanceWhere.date = {
        gte: termInfo.startDate,
        lte: termInfo.endDate,
      }
    }

    const attendance = await prisma.attendance.findMany({
      where: attendanceWhere,
      select: { date: true, status: true },
      orderBy: { date: 'asc' },
    })

    const totalDays = attendance.length
    const presentDays = attendance.filter(a => a.status === 'PRESENT').length
    const absentDays = attendance.filter(a => a.status === 'ABSENT').length
    const lateDays = attendance.filter(a => a.status === 'LATE').length

    // ── 6. Class averages per subject ────────────────────────────────────
    // Fetch all results for the same class + term to compute class average
    const classResultsWhere: Record<string, unknown> = {
      schoolId: student.schoolId,
      student: { classId: student.classId },
      ...(termId ? { termId } : {}),
    }
    const classResults = await prisma.result.findMany({
      where: classResultsWhere,
      select: { subjectId: true, totalScore: true, maxScore: true, testScore: true, examScore: true, examType: true },
    })

    // Build subject → class average map
    const classSubjectMap = new Map<string, { scores: number[]; maxScore: number }>()
    for (const r of classResults) {
      const score = r.totalScore ?? (r.examType === 'FINAL' ? r.examScore : r.testScore) ?? null
      if (score == null) continue
      const existing = classSubjectMap.get(r.subjectId)
      if (existing) {
        existing.scores.push(score)
        existing.maxScore = Math.max(existing.maxScore, r.maxScore)
      } else {
        classSubjectMap.set(r.subjectId, { scores: [score], maxScore: r.maxScore })
      }
    }

    const classAverageBySubject: Record<string, { avg: number; maxScore: number }> = {}
    for (const [subId, { scores, maxScore }] of classSubjectMap.entries()) {
      classAverageBySubject[subId] = {
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
        maxScore,
      }
    }

    // ── 7. Class position ────────────────────────────────────────────────
    // For the specific term, rank all students in the class by their average total score
    const classStudents = await prisma.student.findMany({
      where: { classId: student.classId, schoolId: student.schoolId },
      select: { id: true },
    })
    const classStudentIds = classStudents.map(s => s.id)

    const allClassResults = await prisma.result.findMany({
      where: {
        schoolId: student.schoolId,
        studentId: { in: classStudentIds },
        ...(termId ? { termId } : {}),
      },
      select: { studentId: true, totalScore: true, maxScore: true, testScore: true, examScore: true, examType: true },
    })

    // Sum scores per student
    const studentScores = new Map<string, number[]>()
    for (const r of allClassResults) {
      const score = r.totalScore ?? (r.examType === 'FINAL' ? r.examScore : r.testScore) ?? null
      if (score == null) continue
      const arr = studentScores.get(r.studentId) ?? []
      arr.push(score)
      studentScores.set(r.studentId, arr)
    }

    // Rank
    const rankedStudents = Array.from(studentScores.entries())
      .map(([sid, scores]) => ({
        studentId: sid,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => b.avg - a.avg)

    const positionIndex = rankedStudents.findIndex(s => s.studentId === studentId)
    const classPosition = positionIndex >= 0 ? positionIndex + 1 : null
    const classSize = classStudentIds.length

    // ── 8. All-term breakdown for Final Year view ─────────────────────
    const allTermResults: {
      termId: string
      termName: string
      subjectId: string
      subjectName: string
      score: number | null
      maxScore: number
    }[] = []

    if (!termId && academicYearId) {
      const allTerms = await prisma.terms.findMany({
        where: { academic_year_id: academicYearId, school_id: student.schoolId },
        orderBy: { start_date: 'asc' },
      })
      for (const t of allTerms) {
        const tResults = await prisma.result.findMany({
          where: { studentId, termId: t.id },
          include: { subject: { select: { id: true, name: true } } },
        })
        for (const r of tResults) {
          allTermResults.push({
            termId: t.id,
            termName: t.name,
            subjectId: r.subjectId,
            subjectName: r.subject.name,
            score: r.totalScore ?? (r.examType === 'FINAL' ? r.examScore : r.testScore),
            maxScore: r.maxScore,
          })
        }
      }
    }

    // ── 9. Shape subject rows ────────────────────────────────────────────
    // Merge Result rows + StudentAssessment rows into a unified per-subject list
    const subjectMap = new Map<
      string,
      {
        subjectId: string
        subjectName: string
        subjectCode: string | null
        teacherName: string | null
        score: number | null
        maxScore: number
        grade: string | null
        comment: string | null
        termName: string | null
        classAvg: number | null
      }
    >()

    // Primacy: Result rows
    for (const r of results) {
      const score = r.totalScore ?? (r.examType === 'FINAL' ? r.examScore : r.testScore) ?? null
      subjectMap.set(r.subjectId, {
        subjectId: r.subjectId,
        subjectName: r.subject.name,
        subjectCode: r.subject.code ?? null,
        teacherName: null, // filled below from ClassSubjectTeacher
        score,
        maxScore: r.maxScore,
        grade: r.grade,
        comment: r.comment,
        termName: r.terms?.name ?? r.term ?? null,
        classAvg: classAverageBySubject[r.subjectId]?.avg ?? null,
      })
    }

    // Fill in teacher names from ClassSubjectTeacher
    const subjectIds = Array.from(subjectMap.keys())
    if (subjectIds.length > 0) {
      const assignments = await prisma.classSubjectTeacher.findMany({
        where: { classId: student.classId, subjectId: { in: subjectIds } },
        include: {
          teacher: { select: { firstName: true, lastName: true, title: true } },
          subject: { select: { id: true } },
        },
      })
      for (const a of assignments) {
        const row = subjectMap.get(a.subjectId)
        if (row && !row.teacherName) {
          const t = a.teacher
          row.teacherName = [t.title, t.firstName, t.lastName].filter(Boolean).join(' ')
        }
      }
    }

    // Supplement: StudentAssessment aggregated scores for subjects not in Result
    const assessmentSubjectMap = new Map<
      string,
      { subjectId: string; subjectName: string; subjectCode: string | null; teacherName: string | null; scores: number[]; maxScore: number; feedbacks: string[] }
    >()
    for (const sa of studentAssessments) {
      const { subject, teacher } = sa.assessment
      if (!subjectMap.has(subject.id)) {
        const existing = assessmentSubjectMap.get(subject.id)
        if (existing) {
          if (sa.score != null) existing.scores.push(sa.score)
          if (sa.feedback) existing.feedbacks.push(sa.feedback)
          existing.maxScore = Math.max(existing.maxScore, sa.assessment.totalMarks)
        } else {
          const tName = [teacher.title, teacher.firstName, teacher.lastName].filter(Boolean).join(' ')
          assessmentSubjectMap.set(subject.id, {
            subjectId: subject.id,
            subjectName: subject.name,
            subjectCode: subject.code ?? null,
            teacherName: tName,
            scores: sa.score != null ? [sa.score] : [],
            maxScore: sa.assessment.totalMarks,
            feedbacks: sa.feedback ? [sa.feedback] : [],
          })
        }
      }
    }
    for (const [, v] of assessmentSubjectMap.entries()) {
      const avg = v.scores.length > 0 ? v.scores.reduce((a, b) => a + b, 0) / v.scores.length : null
      subjectMap.set(v.subjectId, {
        subjectId: v.subjectId,
        subjectName: v.subjectName,
        subjectCode: v.subjectCode,
        teacherName: v.teacherName,
        score: avg,
        maxScore: v.maxScore,
        grade: avg != null ? computeGrade((avg / v.maxScore) * 100) : null,
        comment: v.feedbacks.join(' ') || null,
        termName: termInfo?.name ?? null,
        classAvg: classAverageBySubject[v.subjectId]?.avg ?? null,
      })
    }

    const subjectRows = Array.from(subjectMap.values())

    // Overall average
    const scoredRows = subjectRows.filter(r => r.score != null && r.maxScore > 0)
    const overallPct =
      scoredRows.length > 0
        ? scoredRows.reduce((acc, r) => acc + (r.score! / r.maxScore) * 100, 0) / scoredRows.length
        : null

    return NextResponse.json({
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNumber: student.admissionNumber,
        academicYear: student.academicYear,
        class: {
          id: student.class.id,
          name: student.class.name,
          grade: student.class.grade,
          formTeacher: student.class.teacher
            ? {
                name: [
                  student.class.teacher.title,
                  student.class.teacher.firstName,
                  student.class.teacher.lastName,
                ]
                  .filter(Boolean)
                  .join(' '),
              }
            : null,
        },
        school: { name: student.school.name },
      },
      term: termInfo,
      subjects: subjectRows,
      overallAverage: overallPct,
      attendance: { totalDays, presentDays, absentDays, lateDays },
      position: { rank: classPosition, classSize },
      allTermResults,
    })
  } catch (error) {
    console.error('Error generating student report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

function computeGrade(pct: number): string {
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B'
  if (pct >= 60) return 'C'
  if (pct >= 50) return 'D'
  return 'F'
}
