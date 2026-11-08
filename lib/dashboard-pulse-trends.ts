/**
 * School Pulse sparkline builders.
 *
 * Window choices:
 * - Attendance / teacher absence: last 7 weekdays (Mon–Fri) as a school-day proxy.
 *   Full school calendars (holidays) are not modeled, so weekends are skipped only.
 * - Enrollments / teachers / fees / academics: weeks within the current term
 *   (same week-bucketing pattern as academic trendByWeek).
 */

export type PulseTrends = {
  totalStudents: number[]
  newThisTerm: number[]
  absentToday: number[]
  feeDefaulters: number[]
  belowPassMark: number[]
  totalTeachers: number[]
  teachersAbsent: number[]
  unassignedSubjects: number[]
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function toUtcDayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function weekCount(startDate: Date, endDate: Date) {
  const start = toUtcDayStart(startDate)
  const end = toUtcDayStart(endDate)
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1)
  return Math.max(1, Math.ceil(days / 7))
}

/** Last N weekdays ending on/before `endDate` (inclusive), oldest → newest. */
export function lastNWeekdays(endDate: Date, count: number): Date[] {
  const days: Date[] = []
  const cursor = toUtcDayStart(endDate)

  while (days.length < count) {
    const dow = cursor.getUTCDay()
    if (dow >= 1 && dow <= 5) {
      days.push(new Date(cursor))
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  return days.reverse()
}

export function termWeekEnds(termStart: Date, weeks: number): Date[] {
  const start = toUtcDayStart(termStart)
  return Array.from({ length: weeks }, (_, index) => {
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + (index + 1) * 7 - 1)
    return end
  })
}

export function currentTermWeekCount(termStart: Date, termEnd: Date, today: Date) {
  const totalWeeks = weekCount(termStart, termEnd)
  const start = toUtcDayStart(termStart)
  const day = toUtcDayStart(today)
  const elapsedDays = Math.floor((day.getTime() - start.getTime()) / MS_PER_DAY) + 1
  if (elapsedDays <= 0) return 1
  return Math.min(totalWeeks, Math.max(1, Math.ceil(elapsedDays / 7)))
}

function dayKey(date: Date) {
  return toUtcDayStart(date).toISOString().slice(0, 10)
}

export function bucketCountsByDay(dates: Date[], countsByDay: Map<string, number>): number[] {
  return dates.map((date) => countsByDay.get(dayKey(date)) || 0)
}

export function cumulativeCreatedByWeek(
  createdAts: Date[],
  termStart: Date,
  weeks: number
): number[] {
  const weekEnds = termWeekEnds(termStart, weeks)
  const sorted = [...createdAts].map((d) => new Date(d).getTime()).sort((a, b) => a - b)
  let pointer = 0
  const series: number[] = []

  for (const end of weekEnds) {
    const endMs = toUtcDayStart(end).getTime() + MS_PER_DAY - 1
    while (pointer < sorted.length && sorted[pointer] <= endMs) {
      pointer += 1
    }
    series.push(pointer)
  }

  return series
}

export function createdPerWeek(createdAts: Date[], termStart: Date, weeks: number): number[] {
  const start = toUtcDayStart(termStart)
  const counts = Array.from({ length: weeks }, () => 0)

  for (const createdAt of createdAts) {
    const day = toUtcDayStart(new Date(createdAt))
    const elapsedDays = Math.floor((day.getTime() - start.getTime()) / MS_PER_DAY)
    const idx = Math.floor(elapsedDays / 7)
    if (idx < 0 || idx >= weeks) continue
    counts[idx] += 1
  }

  return counts
}

export function flatSeries(value: number, length: number): number[] {
  const safeLength = Math.max(1, length)
  const safeValue = Number.isFinite(value) ? value : 0
  return Array.from({ length: safeLength }, () => safeValue)
}

export function teacherAbsentCountsByDay(
  days: Date[],
  offDays: Array<{ teacher_id: string; start_date: Date; end_date: Date }>
): number[] {
  return days.map((day) => {
    const dayStart = toUtcDayStart(day)
    const teacherIds = new Set<string>()
    for (const row of offDays) {
      const start = toUtcDayStart(new Date(row.start_date))
      const end = toUtcDayStart(new Date(row.end_date))
      if (dayStart >= start && dayStart <= end) {
        teacherIds.add(row.teacher_id)
      }
    }
    return teacherIds.size
  })
}

type BelowPassRow = {
  studentId: string
  totalScore: number | null
  maxScore: number
  createdAt: Date
  updatedAt: Date
  subjectPassRate: number | null
}

function scorePercent(totalScore: number | null, maxScore: number) {
  if (!maxScore || maxScore <= 0) return null
  if (totalScore === null || totalScore === undefined) return null
  return (Number(totalScore) / Number(maxScore)) * 100
}

/** Students whose average exam % is below the school default pass mark. */
export function belowPassMarkCount(rows: BelowPassRow[], defaultPassMark: number) {
  const byStudent = new Map<string, { sum: number; count: number }>()

  for (const row of rows) {
    const percent = scorePercent(row.totalScore, row.maxScore)
    if (percent === null) continue
    const existing = byStudent.get(row.studentId) || { sum: 0, count: 0 }
    existing.sum += percent
    existing.count += 1
    byStudent.set(row.studentId, existing)
  }

  let count = 0
  for (const acc of byStudent.values()) {
    if (acc.count > 0 && acc.sum / acc.count < defaultPassMark) count += 1
  }

  return count
}

/** Distinct students with a below-pass score in each term week. */
export function belowPassStudentsPerWeek(
  rows: BelowPassRow[],
  termStart: Date,
  weeks: number,
  defaultPassMark: number
): number[] {
  const start = toUtcDayStart(termStart)
  const weekSets = Array.from({ length: weeks }, () => new Set<string>())

  for (const row of rows) {
    const percent = scorePercent(row.totalScore, row.maxScore)
    if (percent === null) continue
    const passMark = row.subjectPassRate ?? defaultPassMark
    if (percent >= passMark) continue

    const sourceDate = row.updatedAt || row.createdAt
    const day = toUtcDayStart(new Date(sourceDate))
    const elapsedDays = Math.floor((day.getTime() - start.getTime()) / MS_PER_DAY)
    const idx = Math.floor(elapsedDays / 7)
    if (idx < 0 || idx >= weeks) continue
    weekSets[idx].add(row.studentId)
  }

  return weekSets.map((set) => set.size)
}

/**
 * Weekly unpaid-account proxy: students whose cumulative payments up to each
 * week-end are still below their applicable schedule amountDue.
 * Not a true point-in-time ledger snapshot — payments dated after the week-end
 * are excluded, which approximates "unpaid trend over the term".
 */
export function unpaidStudentsPerWeek(params: {
  students: Array<{ id: string; classId: string | null }>
  classScheduleAmount: Map<string, number>
  schoolWideAmount: number | null
  payments: Array<{ studentId: string; amountPaid: number; paymentDate: Date }>
  termStart: Date
  weeks: number
}): number[] {
  const { students, classScheduleAmount, schoolWideAmount, payments, termStart, weeks } = params
  if (students.length === 0 || weeks <= 0) return flatSeries(0, Math.max(1, weeks))
  if (classScheduleAmount.size === 0 && schoolWideAmount == null) {
    return flatSeries(0, weeks)
  }

  const weekEnds = termWeekEnds(termStart, weeks)
  const paymentsByStudent = new Map<string, Array<{ amount: number; at: number }>>()

  for (const payment of payments) {
    const list = paymentsByStudent.get(payment.studentId) || []
    list.push({
      amount: Number(payment.amountPaid || 0),
      at: new Date(payment.paymentDate).getTime(),
    })
    paymentsByStudent.set(payment.studentId, list)
  }

  for (const list of paymentsByStudent.values()) {
    list.sort((a, b) => a.at - b.at)
  }

  return weekEnds.map((end) => {
    const endMs = toUtcDayStart(end).getTime() + MS_PER_DAY - 1
    let unpaid = 0

    for (const student of students) {
      const amountDue =
        (student.classId ? classScheduleAmount.get(student.classId) : undefined) ??
        schoolWideAmount
      if (amountDue == null) continue

      const list = paymentsByStudent.get(student.id) || []
      let paid = 0
      for (const entry of list) {
        if (entry.at > endMs) break
        paid += entry.amount
      }
      if (paid < amountDue) unpaid += 1
    }

    return unpaid
  })
}
