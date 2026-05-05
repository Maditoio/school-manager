'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'
import { translateText } from '@/lib/client-i18n'
import { useCurrency } from '@/lib/currency-context'
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
  const { formatCurrency } = useCurrency()
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
      <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold ui-text-primary">{t('Course Earnings')}</h1>
          <p className="text-sm ui-text-secondary mt-1">{t('Track revenue from your paid courses')}</p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="ui-card p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs ui-text-secondary font-medium uppercase tracking-wide">{t('Total Revenue')}</p>
                  <p className="text-2xl font-bold ui-text-primary mt-1">
                    ${summary.totalRevenue.toFixed(2)}
                  </p>
                </div>
                <MaterialIcon name="trending_up" className="text-4xl text-emerald-500" />
              </div>
            </div>

            <div className="ui-card p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs ui-text-secondary font-medium uppercase tracking-wide">{t('Paid Students')}</p>
                  <p className="text-2xl font-bold ui-text-primary mt-1">{summary.totalPaidEnrollments}</p>
                </div>
                <MaterialIcon name="person_add" className="text-4xl text-blue-500" />
              </div>
            </div>

            <div className="ui-card p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs ui-text-secondary font-medium uppercase tracking-wide">{t('Total Students')}</p>
                  <p className="text-2xl font-bold ui-text-primary mt-1">{summary.totalStudents}</p>
                </div>
                <MaterialIcon name="group" className="text-4xl text-purple-500" />
              </div>
            </div>

            <div className="ui-card p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs ui-text-secondary font-medium uppercase tracking-wide">{t('Active Courses')}</p>
                  <p className="text-2xl font-bold ui-text-primary mt-1">{summary.totalCourses}</p>
                </div>
                <MaterialIcon name="video_library" className="text-4xl text-orange-500" />
              </div>
            </div>
          </div>
        )}

        {/* Courses Table */}
        <div className="ui-card rounded-lg overflow-hidden">
          <div className="border-b ui-border p-4">
            <h2 className="font-semibold ui-text-primary">{t('Your Courses')}</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center ui-text-secondary text-sm">{t('Loading courses…')}</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500 text-sm">{error}</div>
          ) : courses.length === 0 ? (
            <div className="p-8 text-center ui-text-secondary">
              <MaterialIcon name="video_library" className="text-6xl mb-2" />
              <p className="font-medium ui-text-primary">{t('No courses yet')}</p>
              <p className="text-sm mt-1">{t('Create your first course to start earning')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="ui-text-secondary border-b ui-border bg-opacity-50">
                  <tr className="text-left">
                    <th className="p-4 font-semibold">{t('Course Title')}</th>
                    <th className="p-4 font-semibold text-right">{t('Price')}</th>
                    <th className="p-4 font-semibold text-right">{t('Paid / Total Students')}</th>
                    <th className="p-4 font-semibold text-right">{t('Total Earnings')}</th>
                    <th className="p-4 font-semibold text-center">{t('Lessons')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y ui-border">
                  {courses.map((course) => (
                    <tr key={course.id} className="hover:bg-opacity-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {course.thumbnailUrl && (
                            <img
                              src={course.thumbnailUrl}
                              alt={course.title}
                              className="w-10 h-10 rounded object-cover"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium ui-text-primary truncate">{course.title}</p>
                            <p className="text-xs ui-text-secondary mt-0.5">
                              {course.freeEnrollments > 0 && `${course.freeEnrollments} ${t('Free')}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right font-semibold ui-text-primary">
                        {course.price > 0 ? `$${course.price.toFixed(2)}` : t('Free')}
                      </td>
                      <td className="p-4 text-right ui-text-primary">
                        <span className="font-medium">{course.paidEnrollments}</span>
                        <span className="ui-text-secondary"> / {course.totalEnrollments}</span>
                      </td>
                      <td className="p-4 text-right font-bold">
                        <span className="text-emerald-600">${course.totalEarnings.toFixed(2)}</span>
                      </td>
                      <td className="p-4 text-center ui-text-secondary">{course.totalLessons}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
