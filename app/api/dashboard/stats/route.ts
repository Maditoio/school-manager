import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateAttendancePercentage } from "@/lib/utils"
import {
  getSchoolAdminCachedStats,
  SchoolAdminDashboardStats,
  setSchoolAdminCachedStats,
} from '@/lib/dashboard-cache'

function percentDelta(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0
  }
  return ((current - previous) / previous) * 100
}

function formatDelta(delta: number, reference: string) {
  const rounded = Math.abs(delta).toFixed(1)
  const sign = delta >= 0 ? '+' : '-'
  return `${sign}${rounded}% vs ${reference}`
}

function paymentMethodLabel(method: 'CASH' | 'BANK_TRANSFER' | 'M_PESA' | 'ORANGE_MONEY' | 'OTHER') {
  if (method === 'CASH') return 'Cash'
  if (method === 'BANK_TRANSFER') return 'Bank Transfer'
  if (method === 'M_PESA') return 'M-Pesa'
  if (method === 'ORANGE_MONEY') return 'Orange Money'
  return 'Other'
}

type AcademicRow = {
  totalScore: number | null
  maxScore: number
  createdAt: Date
  updatedAt: Date
  className: string
  gradeLabel: string
}

const PASS_MARK_PERCENT = 50

function roundOne(value: number) {
  return Number(value.toFixed(1))
}

function resultPercent(totalScore: number | null, maxScore: number) {
  if (!maxScore || maxScore <= 0) return null
  if (totalScore === null || totalScore === undefined) return null
  return (Number(totalScore) / Number(maxScore)) * 100
}

function toUtcDayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function weekCount(startDate: Date, endDate: Date) {
  const start = toUtcDayStart(startDate)
  const end = toUtcDayStart(endDate)
  const msPerDay = 24 * 60 * 60 * 1000
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1)
  return Math.max(1, Math.ceil(days / 7))
}

function termWeekAverages(rows: AcademicRow[], startDate: Date, weeks: number) {
  const start = toUtcDayStart(startDate)
  const sums = Array.from({ length: weeks }, () => 0)
  const counts = Array.from({ length: weeks }, () => 0)
  const msPerDay = 24 * 60 * 60 * 1000

  for (const row of rows) {
    const percent = resultPercent(row.totalScore, row.maxScore)
    if (percent === null) continue

    const sourceDate = row.updatedAt || row.createdAt
    const day = toUtcDayStart(new Date(sourceDate))
    const elapsedDays = Math.floor((day.getTime() - start.getTime()) / msPerDay)
    const idx = Math.floor(elapsedDays / 7)
    if (idx < 0 || idx >= weeks) continue

    sums[idx] += percent
    counts[idx] += 1
  }

  return sums.map((sum, index) => (counts[index] > 0 ? roundOne(sum / counts[index]) : 0))
}

async function getAcademicRowsForTerm(params: {
  schoolId: string
  termId: string
  termName: string
  academicYear: number
}) {
  const studentAssessments = await prisma.studentAssessment.findMany({
    where: {
      score: { not: null },
      assessment: {
        schoolId: params.schoolId,
        OR: [
          { termId: params.termId },
          {
            termId: null,
            term: params.termName,
            academicYear: params.academicYear,
          },
        ],
      },
    },
    select: {
      score: true,
      createdAt: true,
      updatedAt: true,
      assessment: {
        select: {
          totalMarks: true,
        },
      },
      student: {
        select: {
          class: {
            select: {
              name: true,
              grade: true,
            },
          },
        },
      },
    },
  })

  if (studentAssessments.length > 0) {
    return studentAssessments.map((row) => ({
      totalScore: row.score,
      maxScore: Number(row.assessment.totalMarks),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      className: row.student.class?.name || '-',
      gradeLabel: row.student.class?.grade?.trim() || row.student.class?.name || '-',
    })) as AcademicRow[]
  }

  const legacyResults = await prisma.result.findMany({
    where: {
      schoolId: params.schoolId,
      OR: [
        { termId: params.termId },
        {
          termId: null,
          term: params.termName,
          year: params.academicYear,
        },
      ],
    },
    select: {
      totalScore: true,
      maxScore: true,
      createdAt: true,
      updatedAt: true,
      student: {
        select: {
          class: {
            select: {
              name: true,
              grade: true,
            },
          },
        },
      },
    },
  })

  return legacyResults.map((row) => ({
    totalScore: row.totalScore,
    maxScore: Number(row.maxScore),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    className: row.student.class?.name || '-',
    gradeLabel: row.student.class?.grade?.trim() || row.student.class?.name || '-',
  })) as AcademicRow[]
}

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schoolId = session.user.schoolId

    if (session.user.role === 'SUPER_ADMIN') {
      // Super Admin stats
      const schoolsCount = await prisma.school.count()
      const activeSchools = await prisma.school.count({
        where: { active: true },
      })
      const totalUsers = await prisma.user.count()
      const totalStudents = await prisma.student.count()

      return NextResponse.json({
        schoolsCount,
        activeSchools,
        totalUsers,
        totalStudents,
      })
    }

    if (session.user.role === 'SCHOOL_ADMIN' || session.user.role === 'DEPUTY_ADMIN') {
      if (!schoolId) {
        return NextResponse.json({ error: 'School ID required' }, { status: 400 })
      }

      const { searchParams } = new URL(request.url)
      const forceRefresh = searchParams.get('refresh') === '1'

      const cachedStats = forceRefresh ? null : getSchoolAdminCachedStats(schoolId)
      if (cachedStats) {
        return NextResponse.json(cachedStats)
      }

      // Attendance stats for today (UTC-normalized to match date-only writes from UI)
      const todayIso = new Date().toISOString().slice(0, 10)
      const startOfDay = new Date(`${todayIso}T00:00:00.000Z`)
      const endOfDay = new Date(`${todayIso}T00:00:00.000Z`)
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

      const [
        studentsCount,
        teachersCount,
        classesCount,
        presentCount,
        absentTodayCount,
        todayAttendanceCount,
        teacherOffDaysToday,
        currentTerm,
      ] = await Promise.all([
        prisma.student.count({ where: { schoolId } }),
        prisma.user.count({
          where: {
            schoolId,
            role: 'TEACHER',
          },
        }),
        prisma.class.count({ where: { schoolId } }),
        prisma.attendance.count({
          where: {
            schoolId,
            status: 'PRESENT',
            date: {
              gte: startOfDay,
              lt: endOfDay,
            },
          },
        }),
        prisma.attendance.count({
          where: {
            schoolId,
            status: 'ABSENT',
            date: {
              gte: startOfDay,
              lt: endOfDay,
            },
          },
        }),
        prisma.attendance.count({
          where: {
            schoolId,
            date: {
              gte: startOfDay,
              lt: endOfDay,
            },
          },
        }),
        prisma.teacher_off_days.findMany({
          where: {
            school_id: schoolId,
            start_date: { lte: startOfDay },
            end_date: { gte: startOfDay },
          },
          distinct: ['teacher_id'],
          select: { teacher_id: true },
        }),
        (async () => {
          const term = await prisma.terms.findFirst({
            where: {
              school_id: schoolId,
              is_current: true,
            },
            include: {
              academic_years: {
                select: {
                  year: true,
                },
              },
            },
            orderBy: {
              created_at: 'desc',
            },
          })

          if (!term) return null

          return {
            id: term.id,
            name: term.name,
            startDate: term.start_date,
            endDate: term.end_date,
            academicYear: {
              year: term.academic_years.year,
            },
          }
        })(),
      ])

      const attendanceRate = calculateAttendancePercentage(presentCount, todayAttendanceCount)
      const teachersAbsentCount = teacherOffDaysToday.length
      const offDayTeacherIds = new Set(teacherOffDaysToday.map((row) => row.teacher_id))
      const todayWeekday = startOfDay.getUTCDay()
      const isWeekday = todayWeekday >= 1 && todayWeekday <= 5

      const [teacherRows, teacherSubjects, pendingResultsByTeacher] = await Promise.all([
        prisma.user.findMany({
          where: {
            schoolId,
            role: 'TEACHER',
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        }),
        prisma.$queryRaw<Array<{ teacher_id: string; subjects: string | null }>>`
          SELECT
            cst.teacher_id,
            STRING_AGG(DISTINCT COALESCE(s.code, s.name), ', ' ORDER BY COALESCE(s.code, s.name)) AS subjects
          FROM class_subject_teachers cst
          JOIN subjects s ON s.id = cst.subject_id
          WHERE cst.school_id = ${schoolId}
          GROUP BY cst.teacher_id
        `,
        prisma.$queryRaw<Array<{ teacher_id: string; pending_count: number }>>`
          SELECT a.teacher_id, COUNT(sa.id)::int AS pending_count
          FROM assessments a
          JOIN assessment_scores sa ON sa.assessment_id = a.id
          WHERE a.school_id = ${schoolId}
            AND sa.graded = false
          GROUP BY a.teacher_id
        `,
      ])

      const subjectsByTeacherId = new Map(
        teacherSubjects.map((row) => [row.teacher_id, row.subjects || 'Unassigned'])
      )
      const pendingByTeacherId = new Map(
        pendingResultsByTeacher.map((row) => [row.teacher_id, Number(row.pending_count || 0)])
      )

      const staffTeachers = teacherRows.map((teacher) => {
        const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Teacher'
        const isAbsentToday = isWeekday && offDayTeacherIds.has(teacher.id)
        return {
          id: teacher.id,
          name: fullName,
          subject: subjectsByTeacherId.get(teacher.id) || 'Unassigned',
          status: isAbsentToday ? 'Absent' as const : 'Present' as const,
          pendingResults: pendingByTeacherId.get(teacher.id) || 0,
        }
      }).sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'Absent' ? -1 : 1
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })

      const totalPendingResults = staffTeachers.reduce((sum, teacher) => sum + teacher.pendingResults, 0)
      const unassignedTeacherSubjects = staffTeachers.filter((teacher) => teacher.subject === 'Unassigned').length

      const staff = {
        teachers: staffTeachers,
        alertCards: [
          {
            id: 'staff-pending-results',
            tone: totalPendingResults > 0 ? 'warning' as const : 'info' as const,
            title: 'Pending Results',
            text:
              totalPendingResults > 0
                ? `${totalPendingResults} submissions awaiting grading`
                : 'No pending grading submissions',
            action: 'View Results',
            actionHref: '/admin/results',
          },
          {
            id: 'staff-unassigned-subjects',
            tone: unassignedTeacherSubjects > 0 ? 'danger' as const : 'info' as const,
            title: 'Unassigned Subjects',
            text:
              unassignedTeacherSubjects > 0
                ? `${unassignedTeacherSubjects} teachers have no subject assignment`
                : 'All teachers have subject assignments',
            action: 'Assign Now',
            actionHref: '/admin/subjects',
          },
          {
            id: 'staff-off-days',
            tone: teachersAbsentCount > 0 ? 'warning' as const : 'info' as const,
            title: 'Teacher Off Days',
            text:
              teachersAbsentCount > 0
                ? `${teachersAbsentCount} teachers on approved off-day today`
                : 'No approved teacher off-days today',
            action: 'View Teachers',
            actionHref: '/admin/teachers',
          },
        ],
      }

      let newThisTermCount = 0
      let feeDefaultersCount = 0

      if (currentTerm) {
        const termStartDate = new Date(currentTerm.startDate)
        const termEndExclusive = new Date(currentTerm.endDate)
        termEndExclusive.setDate(termEndExclusive.getDate() + 1)

        newThisTermCount = await prisma.student.count({
          where: {
            schoolId,
            createdAt: {
              gte: termStartDate,
              lt: termEndExclusive,
            },
          },
        })

        const [studentsInAcademicYear, approvedSchedules] = await Promise.all([
          prisma.student.findMany({
            where: {
              schoolId,
              academicYear: currentTerm.academicYear.year,
            },
            select: { id: true, classId: true },
          }),
          prisma.feeSchedule.findMany({
            where: {
              schoolId,
              year: currentTerm.academicYear.year,
              status: 'APPROVED',
            },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            select: {
              id: true,
              classId: true,
              amountDue: true,
            },
          }),
        ])

        // Build class-specific and school-wide schedule maps
        const classScheduleForDefaulters = new Map(
          approvedSchedules.filter((s) => s.classId !== null).map((s) => [s.classId!, s])
        )
        const schoolWideScheduleForDefaulters =
          approvedSchedules.find((s) => s.classId === null) ?? null
        const latestSchedule = schoolWideScheduleForDefaulters ?? approvedSchedules[0] ?? null

        if (approvedSchedules.length > 0 && studentsInAcademicYear.length > 0) {
          const studentIds = studentsInAcademicYear.map((student) => student.id)
          const scheduleIds = approvedSchedules.map((s) => s.id)

          const groupedPayments = await prisma.feePayment.groupBy({
            by: ['studentId'],
            where: {
              schoolId,
              scheduleId: { in: scheduleIds },
              studentId: { in: studentIds },
            },
            _sum: {
              amountPaid: true,
            },
          })

          const paidByStudentId = new Map(
            groupedPayments.map((entry) => [entry.studentId, Number(entry._sum.amountPaid || 0)])
          )

          feeDefaultersCount = studentsInAcademicYear.filter((student) => {
            const applicable =
              (student.classId ? classScheduleForDefaulters.get(student.classId) : null) ??
              schoolWideScheduleForDefaulters
            if (!applicable) return false
            const totalPaid = paidByStudentId.get(student.id) || 0
            return totalPaid < Number(applicable.amountDue)
          }).length
        }
      }

      const financialYear = currentTerm?.academicYear?.year || new Date().getUTCFullYear()
      const previousYear = financialYear - 1

      const startOfTodayUtc = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
      const startOfTomorrowUtc = new Date(startOfTodayUtc)
      startOfTomorrowUtc.setUTCDate(startOfTomorrowUtc.getUTCDate() + 1)
      const startOfYesterdayUtc = new Date(startOfTodayUtc)
      startOfYesterdayUtc.setUTCDate(startOfYesterdayUtc.getUTCDate() - 1)

      const [
        currentYearSchedules,
        previousYearSchedules,
        studentsInFinancialYear,
        studentsInPreviousYear,
      ] = await Promise.all([
        prisma.feeSchedule.findMany({
          where: {
            schoolId,
            year: financialYear,
            status: 'APPROVED',
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            classId: true,
            amountDue: true,
            periodType: true,
          },
        }),
        prisma.feeSchedule.findMany({
          where: {
            schoolId,
            year: previousYear,
            status: 'APPROVED',
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            classId: true,
            amountDue: true,
            periodType: true,
          },
        }),
        prisma.student.count({
          where: {
            schoolId,
            academicYear: financialYear,
          },
        }),
        prisma.student.count({
          where: {
            schoolId,
            academicYear: previousYear,
          },
        }),
      ])

      // Preferred schedule for target/rate display: school-wide YEARLY → school-wide any → first overall
      const currentPrimarySchedule =
        currentYearSchedules.find((s) => s.classId === null && s.periodType === 'YEARLY') ||
        currentYearSchedules.find((s) => s.classId === null) ||
        currentYearSchedules[0] ||
        null
      const previousPrimarySchedule =
        previousYearSchedules.find((s) => s.classId === null && s.periodType === 'YEARLY') ||
        previousYearSchedules.find((s) => s.classId === null) ||
        previousYearSchedules[0] ||
        null

      // Use all approved schedule IDs so payments across class-specific schedules are counted
      const currentScheduleIds = currentYearSchedules.map((s) => s.id)
      const previousScheduleIds = previousYearSchedules.map((s) => s.id)

      const [
        yearlyPayments,
        previousYearPaymentsAggregate,
        todayPaymentsAggregate,
        yesterdayPaymentsAggregate,
      ] = await Promise.all([
        currentScheduleIds.length > 0
          ? prisma.feePayment.findMany({
              where: {
                schoolId,
                scheduleId: { in: currentScheduleIds },
              },
              select: {
                studentId: true,
                amountPaid: true,
                paymentMethod: true,
              },
            })
          : Promise.resolve([]),
        previousScheduleIds.length > 0
          ? prisma.feePayment.aggregate({
              where: {
                schoolId,
                scheduleId: { in: previousScheduleIds },
              },
              _sum: {
                amountPaid: true,
              },
            })
          : Promise.resolve({ _sum: { amountPaid: 0 } }),
        currentScheduleIds.length > 0
          ? prisma.feePayment.aggregate({
              where: {
                schoolId,
                scheduleId: { in: currentScheduleIds },
                paymentDate: {
                  gte: startOfTodayUtc,
                  lt: startOfTomorrowUtc,
                },
              },
              _sum: {
                amountPaid: true,
              },
              _count: {
                _all: true,
              },
            })
          : Promise.resolve({ _sum: { amountPaid: 0 }, _count: { _all: 0 } }),
        currentScheduleIds.length > 0
          ? prisma.feePayment.aggregate({
              where: {
                schoolId,
                scheduleId: { in: currentScheduleIds },
                paymentDate: {
                  gte: startOfYesterdayUtc,
                  lt: startOfTodayUtc,
                },
              },
              _sum: {
                amountPaid: true,
              },
            })
          : Promise.resolve({ _sum: { amountPaid: 0 } }),
      ])

      const totalCollected = Number(
        yearlyPayments.reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0).toFixed(2)
      )
      const previousCollected = Number(previousYearPaymentsAggregate._sum.amountPaid || 0)
      const todayCollected = Number(todayPaymentsAggregate._sum.amountPaid || 0)
      const yesterdayCollected = Number(yesterdayPaymentsAggregate._sum.amountPaid || 0)
      const todayPaymentsCount = Number(todayPaymentsAggregate._count?._all || 0)

      const targetAmount = Number(
        ((currentPrimarySchedule?.amountDue || 0) * studentsInFinancialYear).toFixed(2)
      )
      const previousTargetAmount = Number(
        ((previousPrimarySchedule?.amountDue || 0) * studentsInPreviousYear).toFixed(2)
      )

      const outstandingBalance = Number(Math.max(targetAmount - totalCollected, 0).toFixed(2))
      const previousOutstandingBalance = Number(Math.max(previousTargetAmount - previousCollected, 0).toFixed(2))
      const progressPercent =
        targetAmount > 0
          ? Math.max(0, Math.min(100, Number(((totalCollected / targetAmount) * 100).toFixed(1))))
          : 0

      const collectionTrend = percentDelta(totalCollected, previousCollected)
      const outstandingTrend = percentDelta(outstandingBalance, previousOutstandingBalance)
      const todayTrend = percentDelta(todayCollected, yesterdayCollected)

      const paidByStudent = new Map<string, number>()
      for (const payment of yearlyPayments) {
        paidByStudent.set(
          payment.studentId,
          (paidByStudent.get(payment.studentId) || 0) + Number(payment.amountPaid || 0)
        )
      }

      // Build class-schedule map for per-student defaulter calc
      const dashClassScheduleMap = new Map(
        currentYearSchedules.filter((s) => s.classId !== null).map((s) => [s.classId!, s])
      )
      const dashSchoolWideSchedule =
        currentYearSchedules.find((s) => s.classId === null) ?? null

      const defaulterCount =
        currentYearSchedules.length > 0 && studentsInFinancialYear > 0
          ? Array.from(paidByStudent.values()).filter((paid) => {
              // approximate: use primary schedule rate for dashboard simplicity
              return paid < (currentPrimarySchedule?.amountDue ?? 0)
            }).length + Math.max(studentsInFinancialYear - paidByStudent.size, 0)
          : 0

      // Suppress unused variable warning
      void dashClassScheduleMap
      void dashSchoolWideSchedule

      const methodAmounts = new Map<string, { amount: number; count: number }>()
      for (const payment of yearlyPayments) {
        const method = paymentMethodLabel(payment.paymentMethod || 'OTHER')
        const existing = methodAmounts.get(method) || { amount: 0, count: 0 }
        existing.amount += Number(payment.amountPaid || 0)
        existing.count += 1
        methodAmounts.set(method, existing)
      }

      if (methodAmounts.size === 0) {
        methodAmounts.set('Other', { amount: 0, count: 0 })
      }

      const methodColors: Record<string, string> = {
        Cash: '#6366f1',
        'Bank Transfer': '#34d399',
        'M-Pesa': '#38bdf8',
        'Orange Money': '#f59e0b',
        Other: '#94a3b8',
      }

      const paymentMethods = Array.from(methodAmounts.entries())
        .map(([name, entry]) => {
          const percent = totalCollected > 0 ? Number(((entry.amount / totalCollected) * 100).toFixed(1)) : 0
          return {
            name,
            percent,
            amount: Number(entry.amount.toFixed(2)),
            count: entry.count,
            color: methodColors[name] || '#94a3b8',
          }
        })
        .sort((a, b) => b.amount - a.amount)

      const financial = {
        periodLabel: `Financial Health · Year ${financialYear}`,
        totalCollected: {
          value: totalCollected,
          sub: formatDelta(collectionTrend, `Year ${previousYear}`),
        },
        outstandingBalance: {
          value: outstandingBalance,
          sub:
            defaulterCount > 0
              ? `${defaulterCount} accounts · ${formatDelta(outstandingTrend, `Year ${previousYear}`)}`
              : `0 accounts · ${formatDelta(outstandingTrend, `Year ${previousYear}`)}`,
        },
        collectedToday: {
          value: todayCollected,
          sub: `${todayPaymentsCount} payments · ${formatDelta(todayTrend, 'yesterday')}`,
        },
        termTarget: {
          value: targetAmount,
          sub:
            targetAmount > 0
              ? `${progressPercent.toFixed(1)}% collected`
              : 'No yearly fee schedule set',
        },
        progressPercent,
        progressLabel: `${progressPercent.toFixed(1)}% collected`,
        progressCollected: totalCollected,
        progressTarget: targetAmount,
        paymentMethodsTotal: totalCollected,
        paymentMethods,
      }

      let academic: SchoolAdminDashboardStats['academic'] | undefined
      const alerts: SchoolAdminDashboardStats['alerts'] = []

      if (currentTerm) {
        const [currentRows, previousTerms] = await Promise.all([
          getAcademicRowsForTerm({
            schoolId,
            termId: currentTerm.id,
            termName: currentTerm.name,
            academicYear: currentTerm.academicYear.year,
          }),
          (async () => {
            const terms = await prisma.terms.findMany({
              where: {
                school_id: schoolId,
                end_date: {
                  lt: currentTerm.startDate,
                },
              },
              include: {
                academic_years: {
                  select: {
                    year: true,
                  },
                },
              },
              orderBy: [{ academic_years: { year: 'desc' } }, { start_date: 'desc' }],
              take: 2,
            })

            return terms.map((term) => ({
              id: term.id,
              name: term.name,
              startDate: term.start_date,
              endDate: term.end_date,
              academicYear: {
                year: term.academic_years.year,
              },
            }))
          })(),
        ])

        const validPercents: number[] = []
        let passCount = 0
        const classAcc = new Map<string, { sum: number; count: number }>()
        const gradeAcc = new Map<string, { sum: number; count: number; passCount: number }>()

        for (const row of currentRows) {
          const percent = resultPercent(row.totalScore, row.maxScore)
          if (percent === null) continue

          validPercents.push(percent)
          if (percent >= PASS_MARK_PERCENT) passCount += 1

          const classExisting = classAcc.get(row.className) || { sum: 0, count: 0 }
          classExisting.sum += percent
          classExisting.count += 1
          classAcc.set(row.className, classExisting)

          const gradeExisting = gradeAcc.get(row.gradeLabel) || { sum: 0, count: 0, passCount: 0 }
          gradeExisting.sum += percent
          gradeExisting.count += 1
          if (percent >= PASS_MARK_PERCENT) gradeExisting.passCount += 1
          gradeAcc.set(row.gradeLabel, gradeExisting)
        }

        const classAverages = Array.from(classAcc.entries()).map(([name, acc]) => ({
          name,
          average: acc.count > 0 ? roundOne(acc.sum / acc.count) : 0,
        }))

        const topClass = classAverages.length > 0
          ? classAverages.reduce((best, current) => (current.average > best.average ? current : best))
          : { name: '-', average: 0 }

        const lowestClass = classAverages.length > 0
          ? classAverages.reduce((worst, current) => (current.average < worst.average ? current : worst))
          : { name: '-', average: 0 }

        const schoolAverage = validPercents.length > 0
          ? roundOne(validPercents.reduce((sum, value) => sum + value, 0) / validPercents.length)
          : 0

        const overallPassRate = validPercents.length > 0
          ? roundOne((passCount / validPercents.length) * 100)
          : 0

        const gradeAverages = Array.from(gradeAcc.entries())
          .map(([grade, acc]) => ({
            grade,
            average: acc.count > 0 ? roundOne(acc.sum / acc.count) : 0,
            passRate: acc.count > 0 ? roundOne((acc.passCount / acc.count) * 100) : 0,
          }))
          .sort((a, b) => a.grade.localeCompare(b.grade, undefined, { numeric: true, sensitivity: 'base' }))

        const currentWeeks = weekCount(currentTerm.startDate, currentTerm.endDate)
        const currentTrend = termWeekAverages(currentRows, currentTerm.startDate, currentWeeks)

        const [lastRows, previousRows] = await Promise.all([
          previousTerms[0]
            ? getAcademicRowsForTerm({
                schoolId,
                termId: previousTerms[0].id,
                termName: previousTerms[0].name,
                academicYear: previousTerms[0].academicYear.year,
              })
            : Promise.resolve([]),
          previousTerms[1]
            ? getAcademicRowsForTerm({
                schoolId,
                termId: previousTerms[1].id,
                termName: previousTerms[1].name,
                academicYear: previousTerms[1].academicYear.year,
              })
            : Promise.resolve([]),
        ])

        const lastTrend = previousTerms[0]
          ? termWeekAverages(lastRows, previousTerms[0].startDate, currentWeeks)
          : Array.from({ length: currentWeeks }, () => 0)

        const previousTrend = previousTerms[1]
          ? termWeekAverages(previousRows, previousTerms[1].startDate, currentWeeks)
          : Array.from({ length: currentWeeks }, () => 0)

        const trendByWeek = Array.from({ length: currentWeeks }, (_, index) => ({
          week: `W${index + 1}`,
          current: currentTrend[index] || 0,
          last: lastTrend[index] || 0,
          previous: previousTrend[index] || 0,
        }))

        const lastTermAverage = previousTerms[0]
          ? (() => {
              const percents = lastRows
                .map((row) => resultPercent(row.totalScore, row.maxScore))
                .filter((value): value is number => value !== null)
              return percents.length > 0
                ? roundOne(percents.reduce((sum, value) => sum + value, 0) / percents.length)
                : 0
            })()
          : 0

        const schoolAverageDelta = roundOne(schoolAverage - lastTermAverage)

        academic = {
          passRate: overallPassRate,
          topClass,
          lowestClass,
          schoolAverage: {
            value: schoolAverage,
            delta: `${schoolAverageDelta >= 0 ? '+' : ''}${schoolAverageDelta.toFixed(1)}% vs last term`,
          },
          gradeAverages,
          trendByWeek,
        }

        const classRows = await prisma.$queryRaw<Array<{
          id: string
          name: string
          capacity: number | null
          student_count: number
        }>>`
          SELECT
            c.id,
            c.name,
            c.capacity,
            COUNT(s.id)::int AS student_count
          FROM classes c
          LEFT JOIN students s ON s.class_id = c.id
          WHERE c.school_id = ${schoolId}
            AND c.academic_year = ${currentTerm.academicYear.year}
            AND c.capacity IS NOT NULL
          GROUP BY c.id, c.name, c.capacity
        `

        const overCapacity = classRows
          .filter((row) => (row.capacity || 0) > 0 && row.student_count > (row.capacity || 0))
          .sort((a, b) => (b.student_count - (b.capacity || 0)) - (a.student_count - (a.capacity || 0)))

        if (overCapacity.length > 0) {
          const details = overCapacity
            .slice(0, 3)
            .map((row) => `${row.name}: ${row.student_count}/${row.capacity}`)
            .join(', ')

          alerts.push({
            id: 'capacity-overload',
            severity: 'danger',
            message: `${overCapacity.length} classes are over maximum capacity (${details})`,
            context: 'Capacity monitor · immediate adjustment recommended',
            action: 'Manage Enrollment',
            actionHref: '/admin/classes',
          })
        }

        const todayUtc = new Date()
        const todayDate = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate()))
        const contractWindowEnd = new Date(todayDate)
        contractWindowEnd.setUTCDate(contractWindowEnd.getUTCDate() + 14)

        const [expiringContracts, pendingComplaintsRows, oldestPendingComplaintRows] = await Promise.all([
          prisma.$queryRaw<Array<{
            end_date: Date
            first_name: string | null
            last_name: string | null
          }>>`
            SELECT tc.end_date, u.first_name, u.last_name
            FROM teacher_contracts tc
            JOIN users u ON u.id = tc.teacher_id
            WHERE tc.school_id = ${schoolId}
              AND tc.status = 'ACTIVE'
              AND tc.end_date >= ${todayDate}
              AND tc.end_date <= ${contractWindowEnd}
            ORDER BY tc.end_date ASC
          `,
          prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count
            FROM parent_complaints pc
            WHERE pc.school_id = ${schoolId}
              AND pc.status IN ('OPEN', 'IN_REVIEW')
          `,
          prisma.$queryRaw<Array<{ created_at: Date }>>`
            SELECT pc.created_at
            FROM parent_complaints pc
            WHERE pc.school_id = ${schoolId}
              AND pc.status IN ('OPEN', 'IN_REVIEW')
            ORDER BY pc.created_at ASC
            LIMIT 1
          `,
        ])

        const pendingComplaints = Number(pendingComplaintsRows[0]?.count || 0)
        const oldestPendingComplaint = oldestPendingComplaintRows[0] || null

        if (expiringContracts.length > 0) {
          const nearest = expiringContracts[0]
          const teacherName = `${nearest.first_name || ''} ${nearest.last_name || ''}`.trim() || 'Teacher'
          const msPerDay = 24 * 60 * 60 * 1000
          const daysUntil = Math.max(
            0,
            Math.ceil((new Date(nearest.end_date).getTime() - todayDate.getTime()) / msPerDay)
          )

          alerts.push({
            id: 'contracts-expiring',
            severity: 'warning',
            message: `${expiringContracts.length} teacher contracts expiring within 14 days (next: ${teacherName} in ${daysUntil} days)`,
            context: 'HR module · renewal required',
            action: 'View Contracts',
            actionHref: '/admin/contracts',
          })
        }

        if (pendingComplaints > 0) {
          const oldestDays = oldestPendingComplaint
            ? Math.max(
                0,
                Math.floor((todayDate.getTime() - new Date(oldestPendingComplaint.created_at).getTime()) / (24 * 60 * 60 * 1000))
              )
            : 0

          alerts.push({
            id: 'pending-parent-complaints',
            severity: 'warning',
            message: `${pendingComplaints} parent complaints pending response`,
            context: `Parent relations queue · oldest: ${oldestDays} days ago`,
            action: 'View Complaints',
            actionHref: '/admin/complaints',
          })
        }

        const msPerDay = 24 * 60 * 60 * 1000
        const reportDueDate = new Date(currentTerm.endDate)
        const daysToReportDue = Math.ceil(
          (new Date(Date.UTC(reportDueDate.getUTCFullYear(), reportDueDate.getUTCMonth(), reportDueDate.getUTCDate())).getTime() -
            todayDate.getTime()) /
            msPerDay
        )

        if (daysToReportDue >= 0) {
          alerts.push({
            id: 'report-cards-due',
            severity: daysToReportDue <= 3 ? 'warning' : 'info',
            message: `${currentTerm.name} report cards due in ${daysToReportDue} days`,
            context: 'Academic office deadline',
            action: 'Check Progress',
            actionHref: '/admin/results',
          })
        }
      }

      const payload: SchoolAdminDashboardStats = {
        studentsCount,
        teachersCount,
        teachersAbsentCount,
        newThisTermCount,
        feeDefaultersCount,
        absentTodayCount,
        classesCount,
        attendanceRate,
        todayAttendanceCount,
        financial,
        academic,
        staff,
        alerts,
      }

      setSchoolAdminCachedStats(schoolId, payload)

      return NextResponse.json(payload)
    }

    if (session.user.role === 'TEACHER') {
      // Teacher stats across all taught classes (legacy class teacher + class-subject assignments)
      const assignedRows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT DISTINCT c.id
        FROM classes c
        LEFT JOIN class_subject_teachers cst ON cst.class_id = c.id
        WHERE c.school_id = ${schoolId}
          AND (
            c.teacher_id = ${session.user.id}
            OR cst.teacher_id = ${session.user.id}
          )
      `

      const classIds = assignedRows.map((row) => row.id)
      const assignedClasses = classIds.length

      const studentsInClasses = classIds.length > 0
        ? await prisma.student.count({
            where: {
              schoolId: schoolId || undefined,
              classId: { in: classIds },
            },
          })
        : 0

      return NextResponse.json({
        assignedClasses,
        studentsInClasses,
      })
    }

    if (session.user.role === 'PARENT') {
      // Parent stats
      const children = await prisma.student.findMany({
        where: {
          parentId: session.user.id,
        },
        include: {
          attendance: {
            orderBy: { date: 'desc' },
            take: 30,
          },
          results: {
            where: { published: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      })

      const childrenStats = children.map(child => {
        const totalAttendance = child.attendance.length
        const presentCount = child.attendance.filter(a => a.status === 'PRESENT').length
        const attendanceRate = calculateAttendancePercentage(presentCount, totalAttendance)

        const averageScore = child.results.length > 0
          ? child.results.reduce((sum, r) => sum + ((r.totalScore || 0) / r.maxScore * 100), 0) / child.results.length
          : 0

        return {
          studentId: child.id,
          name: `${child.firstName} ${child.lastName}`,
          attendanceRate,
          averageScore: Math.round(averageScore),
          recentResultsCount: child.results.length,
        }
      })

      return NextResponse.json({
        childrenCount: children.length,
        children: childrenStats,
      })
    }

    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
