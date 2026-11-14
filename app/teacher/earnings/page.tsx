'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import Table from '@/components/ui/Table'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'
import { translateText } from '@/lib/client-i18n'
import { useLocale } from '@/lib/locale-context'

interface CourseEarnings {
  id: string
  title: string
  price: number
  thumbnailUrl: string | null
  totalEnrollments: number
  paidEnrollments: number
  freeEnrollments: number
  totalLessons: number
  totalEarnings: number
}

interface EarningsSummary {
  totalCourses: number
  totalRevenue: number
  totalPaidEnrollments: number
  totalStudents: number
}

export default function TeacherEarningsPage() {
  const { data: session, status } = useSession()
  const { locale } = useLocale()
  const t = useCallback((s: string) => translateText(s, locale), [locale])

  const [courses, setCourses] = useState<CourseEarnings[]>([])
  const [summary, setSummary] = useState<EarningsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'TEACHER') redirect('/login')
  }, [session, status])

  const fetchEarnings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/teacher-earnings')
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || t('Failed to load earnings'))
        return
      }
      setCourses(data.courses ?? [])
      setSummary(data.summary ?? null)
    } catch (err) {
      setError(t('Failed to load earnings'))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') fetchEarnings()
  }, [status, fetchEarnings])

  if (status === 'loading' || !session) return null

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Teacher',
        role: 'Teacher',
        email: session.user.email,
      }}
      navItems={TEACHER_NAV_ITEMS}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-[1.25rem] font-semibold ui-text-primary">{t('Course Earnings')}</h1>
          <p className="mt-1 text-sm ui-text-secondary">{t('Track revenue from your paid courses')}</p>
        </div>

        {summary ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: t('Total Revenue'), value: `$${summary.totalRevenue.toFixed(2)}` },
              { label: t('Paid Students'), value: summary.totalPaidEnrollments },
              { label: t('Total Students'), value: summary.totalStudents },
              { label: t('Active Courses'), value: summary.totalCourses },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-[10px] border border-(--border-subtle) bg-(--surface) p-4"
              >
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
                  {card.label}
                </p>
                <p className="mt-2 text-[1.375rem] font-semibold ui-text-primary">{card.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[10px] border border-(--border-subtle) bg-(--surface) p-4 text-sm text-[#c0392b]">
            {error}
          </div>
        ) : (
          <Table
            title={t('Your Courses')}
            columns={[
              {
                key: 'title',
                label: t('Course Title'),
                renderCell: (course: CourseEarnings) => (
                  <div className="flex items-center gap-3">
                    {course.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.thumbnailUrl}
                        alt=""
                        className="h-10 w-10 rounded-[6px] object-cover border border-(--border-subtle)"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate font-medium ui-text-primary">{course.title}</p>
                      {course.freeEnrollments > 0 ? (
                        <p className="mt-0.5 text-xs ui-text-secondary">
                          {course.freeEnrollments} {t('Free')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ),
              },
              {
                key: 'price',
                label: t('Price'),
                renderCell: (course: CourseEarnings) => (
                  <span className="font-semibold ui-text-primary">
                    {course.price > 0 ? `$${course.price.toFixed(2)}` : t('Free')}
                  </span>
                ),
              },
              {
                key: 'enrollments',
                label: t('Paid / Total Students'),
                renderCell: (course: CourseEarnings) => (
                  <span>
                    <span className="font-semibold ui-text-primary">{course.paidEnrollments}</span>
                    <span className="ui-text-secondary"> / {course.totalEnrollments}</span>
                  </span>
                ),
              },
              {
                key: 'earnings',
                label: t('Total Earnings'),
                renderCell: (course: CourseEarnings) => (
                  <span className="font-semibold ui-text-primary">
                    ${course.totalEarnings.toFixed(2)}
                  </span>
                ),
              },
              {
                key: 'lessons',
                label: t('Lessons'),
                renderCell: (course: CourseEarnings) => course.totalLessons,
              },
            ]}
            data={courses}
            loading={loading}
            rowKey="id"
            emptyMessage={t('No courses yet')}
            searchPlaceholder={t('Search courses…')}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
