const DASHBOARD_CACHE_TTL_MS = 60 * 1000

export type SchoolAdminDashboardStats = {
  studentsCount: number
  teachersCount: number
  teachersAbsentCount: number
  newThisTermCount: number
  feeDefaultersCount: number
  absentTodayCount: number
  classesCount: number
  attendanceRate: number
  todayAttendanceCount: number
  financial?: {
    periodLabel: string
    totalCollected: { value: number; sub: string }
    outstandingBalance: { value: number; sub: string }
    collectedToday: { value: number; sub: string }
    termTarget: { value: number; sub: string }
    progressPercent: number
    progressLabel: string
    paymentMethodsTotal: number
    paymentMethods: Array<{
      name: string
      percent: number
      amount: number
      count: number
      color: string
    }>
  }
  academic?: {
    passRate: number
    topClass: { name: string; average: number }
    lowestClass: { name: string; average: number }
    schoolAverage: { value: number; delta: string }
    gradeAverages: Array<{ grade: string; average: number; passRate: number }>
    trendByWeek: Array<{ week: string; current: number; last: number; previous: number }>
  }
  staff?: {
    teachers: Array<{
      id: string
      name: string
      subject: string
      status: 'Present' | 'Absent'
      pendingResults: number
    }>
    alertCards: Array<{
      id: string
      tone: 'warning' | 'danger' | 'info'
      title: string
      text: string
      action: string
      actionHref?: string
    }>
  }
  alerts?: Array<{
    id: string
    severity: 'danger' | 'warning' | 'info'
    message: string
    context: string
    action: string
    actionHref?: string
  }>
}

const schoolAdminDashboardCache = new Map<
  string,
  {
    expiresAt: number
    data: SchoolAdminDashboardStats
  }
>()

export function getSchoolAdminCachedStats(schoolId: string): SchoolAdminDashboardStats | null {
  const cached = schoolAdminDashboardCache.get(schoolId)
  if (!cached) return null

  if (cached.expiresAt <= Date.now()) {
    schoolAdminDashboardCache.delete(schoolId)
    return null
  }

  return cached.data
}

export function setSchoolAdminCachedStats(schoolId: string, data: SchoolAdminDashboardStats) {
  schoolAdminDashboardCache.set(schoolId, {
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
    data,
  })
}

export function invalidateSchoolAdminCachedStats(schoolId: string) {
  schoolAdminDashboardCache.delete(schoolId)
}
