import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  renderTemplate,
  buildSampleVariables,
  buildReportVariables,
  buildPrintDocument,
  BASE_REPORT_CSS,
  type ReportDataInput,
} from '@/lib/report-renderer'

/**
 * GET /api/report-templates/preview
 *
 * Returns a fully rendered HTML document for previewing a template.
 *
 * Query params:
 *   templateId  (required)  — the template to preview
 *   studentId   (optional)  — if provided, uses real student data instead of sample data
 *   termId      (optional)  — used with studentId
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
    const templateId = searchParams.get('templateId')
    const studentId = searchParams.get('studentId')
    const termId = searchParams.get('termId')

    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
    }

    const schoolId = session.user.schoolId ?? null

    // Load the template
    const template = await prisma.reportTemplate.findFirst({
      where: {
        id: templateId,
        OR: [
          { isSystem: true },
          ...(schoolId ? [{ schoolId }] : []),
        ],
      },
      select: { htmlContent: true, cssContent: true, name: true },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    let variables = buildSampleVariables()

    // If a real student is requested, build variables from live data
    if (studentId && schoolId) {
      try {
        const student = await prisma.student.findFirst({
          where: { id: studentId, schoolId },
          include: {
            class: {
              include: {
                teacher: { select: { firstName: true, lastName: true, title: true } },
              },
            },
            school: { select: { name: true } },
          },
        })

        if (student) {
          // Fetch school settings for logo
          const settings = await prisma.schoolSettings.findUnique({
            where: { schoolId },
            select: { logoUrl: true, minimumPassRatePerSubject: true },
          })

          // Fetch results for the given term or all
          const whereResults = {
            studentId,
            schoolId,
            ...(termId ? { termId } : {}),
          }

          const results = await prisma.result.findMany({ where: whereResults })

          // Aggregate subjects
          const subjectIds = [...new Set(results.map((r) => r.subjectId))]
          const subjects = await prisma.subject.findMany({
            where: { id: { in: subjectIds } },
            select: { id: true, name: true, code: true, passRate: true },
          })
          const classSubjectTeachers = await prisma.classSubjectTeacher.findMany({
            where: { classId: student.classId, subjectId: { in: subjectIds } },
            include: { teacher: { select: { firstName: true, lastName: true, title: true } } },
          })
          const subjectMap = new Map(subjects.map((s) => [s.id, s]))
          const teacherMap = new Map(
            classSubjectTeachers.map((c) => [
              c.subjectId,
              [c.teacher.title, c.teacher.firstName, c.teacher.lastName]
                .filter(Boolean)
                .join(' '),
            ]),
          )

          // Class avg calculation
          const classResultsWhere = {
            schoolId,
            ...(termId ? { termId } : {}),
          }
          const classResults = await prisma.result.findMany({ where: classResultsWhere })
          const classAvgMap = new Map<string, { sum: number; count: number }>()
          for (const r of classResults) {
            if (r.totalScore != null) {
              const entry = classAvgMap.get(r.subjectId) ?? { sum: 0, count: 0 }
              entry.sum += r.totalScore
              entry.count += 1
              classAvgMap.set(r.subjectId, entry)
            }
          }

          let termInfo: { name: string; academicYearName: string } | null = null
          if (termId) {
            const term = await prisma.terms.findFirst({
              where: { id: termId, school_id: schoolId },
              include: { academic_years: true },
            })
            if (term) {
              termInfo = {
                name: term.name,
                academicYearName: term.academic_years?.name ?? String(student.academicYear),
              }
            }
          }

          const subjectVarInputs = subjectIds.map((subId) => {
            const result = results.find((r) => r.subjectId === subId)
            const subj = subjectMap.get(subId)
            const classAvgEntry = classAvgMap.get(subId)
            const classAvg =
              classAvgEntry ? classAvgEntry.sum / classAvgEntry.count : null
            return {
              subjectName: subj?.name ?? 'Unknown',
              subjectCode: subj?.code ?? null,
              teacherName: teacherMap.get(subId) ?? null,
              score: result?.totalScore ?? null,
              maxScore: result?.maxScore ?? 100,
              grade: result?.grade ?? null,
              comment: result?.comment ?? null,
              classAvg,
              subjectPassRate: subj?.passRate ?? null,
            }
          })

          const scores = subjectVarInputs
            .filter((s) => s.score != null && s.maxScore > 0)
            .map((s) => (s.score! / s.maxScore) * 100)
          const overallAverage = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null

          // Attendance
          const attendanceWhere = {
            studentId,
            schoolId,
            ...(termId
              ? { termId }
              : {}),
          }
          const attendanceRecords = await prisma.attendance.findMany({ where: attendanceWhere })
          const presentDays = attendanceRecords.filter((a) => a.status === 'PRESENT').length
          const absentDays = attendanceRecords.filter((a) => a.status === 'ABSENT').length
          const lateDays = attendanceRecords.filter((a) => a.status === 'LATE').length

          const dataInput: ReportDataInput = {
            student: {
              firstName: student.firstName,
              lastName: student.lastName,
              admissionNumber: student.admissionNumber,
              academicYear: student.academicYear,
              class: {
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
            subjects: subjectVarInputs,
            overallAverage,
            schoolPassMark: settings?.minimumPassRatePerSubject ?? 50,
            attendance: {
              totalDays: attendanceRecords.length,
              presentDays,
              absentDays,
              lateDays,
            },
            position: { rank: null, classSize: 0 },
            logoUrl: settings?.logoUrl ?? '',
          }

          variables = buildReportVariables(dataInput)
        }
      } catch {
        // Fall back to sample data if anything fails
      }
    }

    const css = (template.cssContent ?? '') + BASE_REPORT_CSS
    const rendered = renderTemplate(template.htmlContent, variables)
    const fullDoc = buildPrintDocument(rendered, css)

    return new NextResponse(fullDoc, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('Error rendering template preview:', error)
    return NextResponse.json({ error: 'Failed to render preview' }, { status: 500 })
  }
}
