import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

const ACADEMIC_EVENT_TYPE = 'ACADEMIC_TERM_SUMMARY'
const PASS_MARK_PERCENT = 50

type AggregationPayload = {
  termId?: string | null
}

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

function termWeekAverages(
  rows: Array<{ updatedAt: Date; createdAt: Date; totalScore: number | null; maxScore: number }>,
  startDate: Date,
  weeks: number
) {
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

type AggregationRow = {
  totalScore: number | null
  maxScore: number
  createdAt: Date
  updatedAt: Date
  student: {
    class: {
      name: string
      grade: string | null
    }
  }
}

async function getTermAggregationRows(params: {
  schoolId: string
  termId: string
  termName: string
  academicYear: number
}) {
  const resultRows = await prisma.result.findMany({
    where: {
      schoolId: params.schoolId,
      termId: params.termId,
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

  if (resultRows.length > 0) {
    return resultRows as AggregationRow[]
  }

  const assessmentRows = await prisma.studentAssessment.findMany({
    where: {
      score: {
        not: null,
      },
      assessment: {
        schoolId: params.schoolId,
        OR: [
          {
            termId: params.termId,
          },
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

  return assessmentRows.map((row) => ({
    totalScore: row.score,
    maxScore: Number(row.assessment.totalMarks),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    student: row.student,
  })) as AggregationRow[]
}

async function getCurrentOrRequestedTerm(schoolId: string, termId?: string | null) {
  if (termId) {
    const term = await prisma.terms.findFirst({
      where: { id: termId, school_id: schoolId },
      include: { academic_years: { select: { year: true } } },
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
  }

  const term = await prisma.terms.findFirst({
    where: { school_id: schoolId, is_current: true },
    include: { academic_years: { select: { year: true } } },
    orderBy: { created_at: 'desc' },
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
}

export async function recomputeAcademicSummaryForTerm(params: { schoolId: string; termId?: string | null }) {
  const term = await getCurrentOrRequestedTerm(params.schoolId, params.termId)
  if (!term) {
    return { updated: false, reason: 'term-not-found' }
  }

  const [currentRows, previousTerms] = await Promise.all([
    getTermAggregationRows({
      schoolId: params.schoolId,
      termId: term.id,
      termName: term.name,
      academicYear: term.academicYear.year,
    }),
    (async () => {
      const terms = await prisma.terms.findMany({
        where: {
          school_id: params.schoolId,
          end_date: {
            lt: term.startDate,
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

      return terms.map((item) => ({
        id: item.id,
        name: item.name,
        startDate: item.start_date,
        endDate: item.end_date,
        academicYear: {
          year: item.academic_years.year,
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

    const className = row.student.class?.name || '-'
    const classExisting = classAcc.get(className) || { sum: 0, count: 0 }
    classExisting.sum += percent
    classExisting.count += 1
    classAcc.set(className, classExisting)

    const gradeLabel = row.student.class?.grade?.trim() || className
    const gradeExisting = gradeAcc.get(gradeLabel) || { sum: 0, count: 0, passCount: 0 }
    gradeExisting.sum += percent
    gradeExisting.count += 1
    if (percent >= PASS_MARK_PERCENT) gradeExisting.passCount += 1
    gradeAcc.set(gradeLabel, gradeExisting)
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

  const currentWeeks = weekCount(term.startDate, term.endDate)
  const currentTrend = termWeekAverages(currentRows, term.startDate, currentWeeks)

  const [lastRows, previousRows] = await Promise.all([
    previousTerms[0]
      ? getTermAggregationRows({
          schoolId: params.schoolId,
          termId: previousTerms[0].id,
          termName: previousTerms[0].name,
          academicYear: previousTerms[0].academicYear.year,
        })
      : Promise.resolve([]),
    previousTerms[1]
      ? getTermAggregationRows({
          schoolId: params.schoolId,
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

  await prisma.dashboard_academic_summaries.upsert({
    where: {
      term_id: term.id,
    },
    update: {
      academic_year: term.academicYear.year,
      term_name: term.name,
      overall_pass_rate: overallPassRate,
      top_class_name: topClass.name,
      top_class_average: topClass.average,
      lowest_class_name: lowestClass.name,
      lowest_class_average: lowestClass.average,
      school_average_mark: schoolAverage,
      school_average_delta: schoolAverageDelta,
      grade_averages: gradeAverages as unknown as Prisma.JsonArray,
      trend_by_week: trendByWeek as unknown as Prisma.JsonArray,
      last_aggregated_at: new Date(),
      updated_at: new Date(),
    },
    create: {
      id: randomUUID(),
      school_id: params.schoolId,
      term_id: term.id,
      academic_year: term.academicYear.year,
      term_name: term.name,
      overall_pass_rate: overallPassRate,
      top_class_name: topClass.name,
      top_class_average: topClass.average,
      lowest_class_name: lowestClass.name,
      lowest_class_average: lowestClass.average,
      school_average_mark: schoolAverage,
      school_average_delta: schoolAverageDelta,
      grade_averages: gradeAverages as unknown as Prisma.JsonArray,
      trend_by_week: trendByWeek as unknown as Prisma.JsonArray,
      last_aggregated_at: new Date(),
      updated_at: new Date(),
    },
  })

  return { updated: true, termId: term.id }
}

export async function enqueueAcademicAggregation(params: { schoolId: string; termId?: string | null }) {
  const dedupeKey = `${ACADEMIC_EVENT_TYPE}:${params.schoolId}:${params.termId || 'CURRENT'}`
  const payload: AggregationPayload = {
    termId: params.termId || null,
  }

  try {
    await prisma.dashboard_aggregation_events.create({
      data: {
        id: randomUUID(),
        school_id: params.schoolId,
        aggregate_type: ACADEMIC_EVENT_TYPE,
        dedupe_key: dedupeKey,
        payload: payload as unknown as Prisma.InputJsonValue,
        updated_at: new Date(),
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return
    }

    throw error
  }
}

export async function processAcademicAggregationEvents(limit = 25) {
  const events = await prisma.dashboard_aggregation_events.findMany({
    where: {
      aggregate_type: ACADEMIC_EVENT_TYPE,
    },
    orderBy: {
      created_at: 'asc',
    },
    take: limit,
  })

  let processed = 0
  let failed = 0

  for (const event of events) {
    try {
      const payload = (event.payload || {}) as AggregationPayload
      await recomputeAcademicSummaryForTerm({
        schoolId: event.school_id,
        termId: payload.termId || null,
      })

      await prisma.dashboard_aggregation_events.delete({
        where: {
          id: event.id,
        },
      })

      processed += 1
    } catch (error) {
      failed += 1
      console.error('Failed processing academic aggregation event', {
        eventId: event.id,
        error,
      })
    }
  }

  return {
    processed,
    failed,
    remaining: Math.max(0, events.length - processed - failed),
  }
}
