'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'

interface MyCourse {
  enrollment: {
    id: string
    paid: boolean
    enrolledAt: string
  }
  course: {
    id: string
    title: string
    description: string | null
    thumbnailUrl: string | null
    totalDuration: number
    teacher: { firstName: string | null; lastName: string | null }
    lessons: Array<{ id: string; duration: number }>
  }
  progress: {
    totalLessons: number
    completedLessons: number
    progressPct: number
    lastLessonId: string | null
  }
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export default function MyCoursesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [courses, setCourses] = useState<MyCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'STUDENT') redirect('/login')
  }, [session, status])

  const fetchMyCourses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/courses/my-courses')
      const data = await res.json()
      setCourses(data.courses ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') fetchMyCourses()
  }, [status, fetchMyCourses])

  if (status === 'loading' || !session) return null

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Student',
        role: 'Student',
        email: session.user.email,
      }}
      navItems={STUDENT_NAV_ITEMS}
    >
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/student/hub')}>
            <span className="inline-flex items-center gap-1.5"><MaterialIcon name="arrow_back" className="text-[18px]" /> Browse</span>
          </Button>
          <div>
            <h1 className="text-xl font-bold ui-text-primary">My Courses</h1>
            <p className="text-sm ui-text-secondary">Track your enrolled courses and progress</p>
          </div>
        </div>

        {/* Summary Stats */}
        {courses.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Enrolled', value: courses.length },
              { label: 'Completed', value: courses.filter(c => c.progress.progressPct === 100).length },
              { label: 'In Progress', value: courses.filter(c => c.progress.progressPct > 0 && c.progress.progressPct < 100).length },
              { label: 'Paid Access', value: courses.filter(c => c.enrollment.paid).length },
            ].map(s => (
              <div key={s.label} className="ui-surface border ui-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold ui-text-primary">{s.value}</p>
                <p className="text-xs ui-text-secondary mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Course List */}
        {loading ? (
          <div className="text-center py-12 ui-text-secondary text-sm">Loading…</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16 ui-text-secondary">
            <div className="mb-3"><MaterialIcon name="library_books" className="text-6xl" /></div>
            <p className="font-medium ui-text-primary">No courses yet</p>
            <p className="text-sm mt-1">Browse the course library and enroll to get started</p>
            <Button className="mt-4" size="sm" onClick={() => router.push('/student/hub')}>Browse Courses</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map(({ enrollment, course, progress }) => {
              const teacherName = [course.teacher.firstName, course.teacher.lastName].filter(Boolean).join(' ') || 'Instructor'
              return (
                <div key={enrollment.id} className="ui-surface border ui-border rounded-xl overflow-hidden">
                  <div className="flex flex-col lg:flex-row">
                    {/* Thumbnail */}
                    <div className="w-full lg:w-64 h-44 lg:h-auto shrink-0 bg-linear-to-br from-(--accent-soft) to-(--surface-soft) relative flex items-center justify-center">
                      {course.thumbnailUrl ? (
                        <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                      ) : (
                        <MaterialIcon name="play_circle" className="text-6xl" />
                      )}
                      <span className="absolute top-3 left-3 text-[11px] px-2 py-0.5 rounded-full bg-black/60 text-white font-semibold tracking-wide">
                        Enrolled
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-4 sm:p-5 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold ui-text-primary leading-tight">{course.title}</h3>
                          <p className="text-xs ui-text-secondary mt-0.5">{teacherName}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {enrollment.paid ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Full Access</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Preview Only</span>
                          )}
                          {progress.progressPct === 100 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Completed</span>
                          )}
                        </div>
                      </div>

                      {course.description && (
                        <p className="text-sm ui-text-secondary line-clamp-2">{course.description}</p>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs ui-text-secondary">
                        <span className="inline-flex items-center gap-1"><MaterialIcon name="video_library" className="text-[14px]" /> {course.lessons.length} lessons</span>
                        <span className="inline-flex items-center gap-1"><MaterialIcon name="schedule" className="text-[14px]" /> {formatDuration(course.totalDuration)}</span>
                        <span className="inline-flex items-center gap-1"><MaterialIcon name="calendar_month" className="text-[14px]" /> Enrolled {formatDate(enrollment.enrolledAt)}</span>
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex justify-between text-xs ui-text-secondary mb-1">
                          <span>{progress.completedLessons}/{progress.totalLessons} lessons completed</span>
                          <span className="font-medium">{progress.progressPct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-(--border) overflow-hidden">
                          <div
                            className="h-full bg-(--accent) transition-all duration-500"
                            style={{ width: `${progress.progressPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => router.push(`/student/hub/course/${course.id}${progress.lastLessonId ? `?lesson=${progress.lastLessonId}` : ''}`)}
                        >
                          {progress.progressPct === 0 ? 'Start Course' : progress.progressPct === 100 ? 'Review Course' : 'Continue Learning'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/student/hub/course/${course.id}`)}
                        >
                          Open Course
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
