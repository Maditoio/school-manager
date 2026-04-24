'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'

interface BrowseCourse {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  price: number
  totalDuration: number
  teacher: { firstName: string | null; lastName: string | null }
  lessons: Array<{ id: string; isFreePreview: boolean; duration: number }>
  _count: { enrollments: number; ratings: number }
  ratings: Array<{ rating: number }>
}

function avgRating(ratings: Array<{ rating: number }>) {
  if (!ratings.length) return null
  return (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function StudentHubPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [courses, setCourses] = useState<BrowseCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'STUDENT') redirect('/login')
  }, [session, status])

  const fetchCourses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/courses')
      const data = await res.json()
      setCourses(data.courses ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') fetchCourses()
  }, [status, fetchCourses])

  async function handleEnroll(courseId: string) {
    setEnrolling(courseId)
    try {
      const res = await fetch(`/api/courses/${courseId}/enroll`, { method: 'POST' })
      if (res.ok) router.push(`/student/hub/course/${courseId}`)
    } finally {
      setEnrolling(null)
    }
  }

  const filtered = courses.filter(c =>
    !search ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  )

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold ui-text-primary">Student Hub</h1>
            <p className="text-sm ui-text-secondary mt-0.5">Browse and learn from courses created by your teachers</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => router.push('/student/hub/my-courses')}>
            📚 My Courses
          </Button>
        </div>

        {/* Search */}
        <input
          type="text"
          className="ui-input"
          placeholder="Search courses…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Course Grid */}
        {loading ? (
          <div className="text-center py-12 ui-text-secondary text-sm">Loading courses…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 ui-text-secondary">
            <div className="text-5xl mb-3">🎬</div>
            <p className="font-medium ui-text-primary">No courses available yet</p>
            <p className="text-sm mt-1">Check back when your teachers publish courses</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(course => {
              const avg = avgRating(course.ratings)
              const teacherName =
                [course.teacher.firstName, course.teacher.lastName].filter(Boolean).join(' ') || 'Instructor'
              const freeLessons = course.lessons.filter(l => l.isFreePreview).length

              return (
                <div key={course.id} className="ui-surface flex flex-col overflow-hidden rounded-xl border ui-border">
                  {/* Thumbnail */}
                  <div className="h-40 bg-linear-to-br from-(--accent-soft) to-(--surface-soft) relative shrink-0">
                    {course.thumbnailUrl ? (
                      <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🎬</div>
                    )}
                    {course.price === 0 && (
                      <span className="absolute top-2 right-2 text-xs font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                        Free
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1 gap-2">
                    <div>
                      <h3 className="font-semibold ui-text-primary leading-tight line-clamp-2">{course.title}</h3>
                      <p className="text-xs ui-text-secondary mt-0.5">{teacherName}</p>
                    </div>
                    {course.description && (
                      <p className="text-xs ui-text-secondary line-clamp-2 flex-1">{course.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs ui-text-secondary">
                      <span>📹 {course.lessons.length} lessons</span>
                      {course.totalDuration > 0 && <span>⏱ {formatDuration(course.totalDuration)}</span>}
                      {freeLessons > 0 && <span>🆓 {freeLessons} free</span>}
                      <span>👤 {course._count.enrollments}</span>
                    </div>
                    {avg && (
                      <span className="text-xs">
                        <span className="text-amber-400">{'★'.repeat(Math.round(parseFloat(avg)))}{'☆'.repeat(5 - Math.round(parseFloat(avg)))}</span>
                        <span className="ui-text-secondary ml-1">{avg}</span>
                      </span>
                    )}
                    <div className="flex items-center justify-between pt-1 mt-auto">
                      <span className="font-bold ui-text-primary">
                        {course.price === 0 ? 'Free' : `${course.price}`}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => router.push(`/student/hub/course/${course.id}`)}>
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleEnroll(course.id)}
                          isLoading={enrolling === course.id}
                        >
                          {course.price === 0 ? 'Enroll Free' : 'Subscribe'}
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
