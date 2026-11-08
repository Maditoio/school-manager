'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  PerformanceTrendChart,
  type TrendType,
} from '@/components/teacher/PerformanceTrendChart'
import { useLocale } from '@/lib/locale-context'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'

type ClassOption = {
  id: string
  name: string
  studentCount: number
}

type TrendPoint = {
  assessmentId: string
  title: string
  type: string
  date: string
  percent: number
  sampleSize: number
}

type TrendResponse = {
  academicYear: number | null
  className: string | null
  points: TrendPoint[]
  byType: Partial<Record<TrendType, TrendPoint[]>>
  typeAverages: Partial<Record<TrendType, number | null>>
  overallAverage: number | null
  message?: string
}

const TYPE_FILTERS: TrendType[] = ['QUIZ', 'EXAM', 'ASSIGNMENT']

function pickDashboardMessages(locale: string) {
  const pack =
    locale === 'fr' ? frMessages : locale === 'sw' ? swMessages : enMessages
  const teacher = ((pack as Record<string, unknown>).teacher || {}) as Record<string, unknown>
  return (teacher.dashboard || {}) as Record<string, string>
}

export function TeacherDashboardClient({
  stats,
  classes,
}: {
  stats: {
    myClasses: number
    myStudents: number
    mySubjects: number
    pendingResults: number
  }
  classes: ClassOption[]
}) {
  const { locale } = useLocale()
  const messages = useMemo(() => pickDashboardMessages(locale), [locale])
  const t = useCallback(
    (key: string, fallback: string) => messages[key] || fallback,
    [messages]
  )

  const [classId, setClassId] = useState(classes[0]?.id || '')
  const [types, setTypes] = useState<TrendType[]>([...TYPE_FILTERS])
  const [trend, setTrend] = useState<TrendResponse | null>(null)
  const [trendLoading, setTrendLoading] = useState(false)

  useEffect(() => {
    if (!classId) {
      setTrend(null)
      return
    }

    let cancelled = false
    async function loadTrend() {
      setTrendLoading(true)
      try {
        // Fetch all three types; UI toggles filter client-side so bars/lines stay in sync without refetch flicker
        const params = new URLSearchParams({
          classId,
          types: TYPE_FILTERS.join(','),
        })
        const res = await fetch(`/api/teacher/performance-trends?${params}`)
        if (!res.ok) throw new Error('Failed')
        const data = (await res.json()) as TrendResponse
        if (!cancelled) setTrend(data)
      } catch {
        if (!cancelled) setTrend(null)
      } finally {
        if (!cancelled) setTrendLoading(false)
      }
    }

    void loadTrend()
    return () => {
      cancelled = true
    }
  }, [classId])

  const toggleType = (type: TrendType) => {
    setTypes((prev) => {
      if (prev.includes(type)) {
        const next = prev.filter((item) => item !== type)
        return next.length > 0 ? next : prev
      }
      return [...prev, type]
    })
  }

  const typeLabels: Record<TrendType, string> = {
    QUIZ: t('typeQuiz', 'Quiz'),
    EXAM: t('typeExam', 'Exam'),
    ASSIGNMENT: t('typeAssignment', 'Assignment'),
  }

  const actions = [
    {
      href: '/teacher/attendance',
      title: t('actionAttendance', 'Mark attendance'),
      description: t('actionAttendanceDesc', 'Take attendance for your classes'),
      primary: true,
    },
    {
      href: '/teacher/assessments',
      title: t('actionAssessments', 'Create assessment'),
      description: t('actionAssessmentsDesc', 'Add quizzes, exams, or assignments'),
      primary: false,
    },
    {
      href: '/teacher/results',
      title: t('actionResults', 'Enter results'),
      description: t('actionResultsDesc', 'Grade and publish student scores'),
      primary: false,
    },
    {
      href: '/teacher/off-days',
      title: t('actionOffDays', 'Book off day'),
      description: t('actionOffDaysDesc', 'Submit a leave date range'),
      primary: false,
    },
  ]

  const kpiCards = [
    { label: t('kpiClasses', 'Classes'), value: stats.myClasses },
    { label: t('kpiStudents', 'Students'), value: stats.myStudents },
    { label: t('kpiSubjects', 'Subjects'), value: stats.mySubjects },
    { label: t('kpiPending', 'Pending results'), value: stats.pendingResults },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.01em] ui-text-primary">
          {t('title', 'Teacher dashboard')}
        </h1>
        <p className="mt-1 text-sm ui-text-secondary">
          {t('subtitle', 'Actions first — then track class performance by result type.')}
        </p>
      </div>

      <section className="rounded-[10px] border border-(--border-subtle) border-l-[3px] border-l-[#635bff] bg-(--surface) p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#635bff]">
            {t('actionsTitle', 'Actions')}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) =>
            action.primary ? (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-[6px] bg-[#635bff] px-4 py-4 text-white transition-all duration-150 ease hover:bg-[#5146e8] active:scale-[0.97]"
              >
                <p className="text-sm font-semibold">{action.title}</p>
                <p className="mt-1 text-xs text-white/80">{action.description}</p>
              </Link>
            ) : (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-[6px] border border-(--border-subtle) bg-(--surface-soft) px-4 py-4 transition-colors duration-150 ease hover:bg-(--field-bg)"
              >
                <p className="text-sm font-semibold ui-text-primary">{action.title}</p>
                <p className="mt-1 text-xs ui-text-secondary">{action.description}</p>
                <span className="mt-3 inline-block text-xs font-medium text-[#635bff]">
                  {t('openLink', 'Open')} →
                </span>
              </Link>
            )
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-[10px] border border-(--border-subtle) bg-(--surface) p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
              {card.label}
            </p>
            <p className="mt-2 text-[22px] font-semibold ui-text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-[10px] border border-(--border-subtle) bg-(--surface) p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
              {t('trendsTitle', 'Performance trends')}
            </h2>
            <p className="mt-1 text-sm ui-text-secondary">
              {t(
                'trendsSubtitle',
                'Select a class to view quiz, exam, and assignment averages for the current academic year.'
              )}
            </p>
          </div>
          {classId ? (
            <Link
              href={`/teacher/classes?classId=${encodeURIComponent(classId)}`}
              className="shrink-0 text-sm font-medium text-[#635bff]"
            >
              {t('openClass', 'Open class')} →
            </Link>
          ) : null}
        </div>

        {classes.length === 0 ? (
          <p className="text-sm ui-text-secondary">
            {t('noClasses', 'No classes assigned yet.')}
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="flex min-w-[200px] flex-1 flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
                  {t('selectClass', 'Class')}
                </span>
                <select
                  className="ui-select h-8 min-h-8 py-0"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.studentCount})
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap items-center gap-3 pb-1 text-sm">
                {trend?.academicYear ? (
                  <span className="ui-text-secondary">
                    {t('academicYear', 'Academic year')}{' '}
                    <span className="font-semibold ui-text-primary">{trend.academicYear}</span>
                  </span>
                ) : null}
                {trend?.overallAverage != null ? (
                  <span className="ui-text-secondary">
                    {t('classAverage', 'Class average')}{' '}
                    <span className="font-semibold ui-text-primary">{trend.overallAverage}%</span>
                  </span>
                ) : null}
              </div>
            </div>

            {trendLoading ? (
              <p className="py-8 text-center text-sm ui-text-secondary">
                {t('loadingTrends', 'Loading trends…')}
              </p>
            ) : (
              <PerformanceTrendChart
                byType={trend?.byType || {}}
                typeAverages={trend?.typeAverages || {}}
                enabledTypes={types}
                onToggleType={toggleType}
                typeLabels={typeLabels}
                emptyLabel={
                  trend?.message ||
                  t(
                    'trendsEmpty',
                    'No graded quiz, exam, or assignment results yet for this class.'
                  )
                }
                categoryAveragesLabel={t('categoryAverages', 'Category averages')}
                trendsLabel={t('trendsOverTime', 'Trends over time')}
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}
