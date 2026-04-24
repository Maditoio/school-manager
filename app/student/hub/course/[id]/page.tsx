'use client'

import { useState, useEffect, useCallback, use, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useRouter, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'

interface Lesson {
  id: string
  title: string
  description: string | null
  videoUrl: string | null
  duration: number
  lessonOrder: number
  isFreePreview: boolean
}

interface ProgressEntry {
  lessonId: string
  completed: boolean
  lastPosition: number
}

interface CourseDetail {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  price: number
  totalDuration: number
  teacher: { firstName: string | null; lastName: string | null }
  lessons: Lesson[]
  ratings: Array<{ rating: number; review: string | null; student: { firstName: string; lastName: string } }>
  _count: { enrollments: number; ratings: number }
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function StudentCoursePlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [enrollment, setEnrollment] = useState<{ paid: boolean } | null>(null)
  const [hasFullAccess, setHasFullAccess] = useState(false)
  const [progress, setProgress] = useState<ProgressEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'STUDENT') redirect('/login')
  }, [session, status])

  const fetchCourse = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/courses/${courseId}`)
      if (!res.ok) { router.push('/student/hub'); return }
      const data = await res.json()
      setCourse(data.course)
      setEnrollment(data.enrollment ?? null)
      setHasFullAccess(data.hasFullAccess ?? false)

      // Set initial lesson
      const lessonParam = searchParams.get('lesson')
      const lessons: Lesson[] = data.course.lessons
      if (lessonParam && lessons.find((l: Lesson) => l.id === lessonParam)) {
        setActiveLessonId(lessonParam)
      } else if (lessons.length > 0) {
        setActiveLessonId(lessons[0].id)
      }
    } finally {
      setLoading(false)
    }
  }, [courseId, router, searchParams])

  const fetchProgress = useCallback(async () => {
    const res = await fetch(`/api/courses/${courseId}/progress`)
    const data = await res.json()
    setProgress(data.progress ?? [])
  }, [courseId])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCourse()
      fetchProgress()
    }
  }, [status, fetchCourse, fetchProgress])

  // Restore video position when lesson changes
  useEffect(() => {
    if (!videoRef.current || !activeLessonId) return
    const saved = progress.find(p => p.lessonId === activeLessonId)
    if (saved && saved.lastPosition > 0) {
      videoRef.current.currentTime = saved.lastPosition
    }
  }, [activeLessonId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTimeUpdate() {
    if (!videoRef.current || !activeLessonId) return
    const pos = Math.floor(videoRef.current.currentTime)
    // Debounce saves
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveProgress(activeLessonId, pos, false)
    }, 5000)
  }

  async function handleVideoEnded() {
    if (!activeLessonId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    await saveProgress(activeLessonId, 0, true)
    fetchProgress()

    // Auto-advance
    if (course) {
      const idx = course.lessons.findIndex(l => l.id === activeLessonId)
      if (idx >= 0 && idx < course.lessons.length - 1) {
        const next = course.lessons[idx + 1]
        if (next.videoUrl) setActiveLessonId(next.id)
      }
    }
  }

  async function saveProgress(lessonId: string, lastPosition: number, completed: boolean) {
    await fetch(`/api/courses/${courseId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId, lastPosition, completed }),
    })
  }

  async function handleMarkComplete(lessonId: string) {
    await saveProgress(lessonId, 0, true)
    fetchProgress()
  }

  async function handleEnroll() {
    setEnrolling(true)
    try {
      const res = await fetch(`/api/courses/${courseId}/enroll`, { method: 'POST' })
      if (res.ok) {
        fetchCourse()
        fetchProgress()
      }
    } finally {
      setEnrolling(false)
    }
  }

  async function handleSubmitRating() {
    if (rating === 0) return
    setSubmittingRating(true)
    try {
      await fetch(`/api/courses/${courseId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, review }),
      })
      setRatingSubmitted(true)
      fetchCourse()
    } finally {
      setSubmittingRating(false)
    }
  }

  if (status === 'loading' || !session) return null

  const activeLesson = course?.lessons.find(l => l.id === activeLessonId)
  const lessonProgress = (lessonId: string) => progress.find(p => p.lessonId === lessonId)
  const completedCount = progress.filter(p => p.completed).length
  const totalLessons = course?.lessons.length ?? 0
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Student',
        role: 'Student',
        email: session.user.email,
      }}
      navItems={STUDENT_NAV_ITEMS}
    >
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Back */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/student/hub')}>
            <span className="inline-flex items-center gap-1.5"><MaterialIcon name="arrow_back" className="text-[18px]" /> Hub</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push('/student/hub/my-courses')}>
            <span className="inline-flex items-center gap-1.5"><MaterialIcon name="library_books" className="text-[18px]" /> My Courses</span>
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-16 ui-text-secondary text-sm">Loading course…</div>
        ) : !course ? null : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main: Video + Info */}
            <div className="flex-1 space-y-4">
              {/* Video Player */}
              <div className="rounded-xl overflow-hidden bg-black aspect-video">
                {activeLesson?.videoUrl ? (
                  <video
                    ref={videoRef}
                    key={activeLesson.id}
                    src={activeLesson.videoUrl}
                    controls
                    className="w-full h-full"
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleVideoEnded}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/60">
                    {!enrollment ? (
                      <>
                        <MaterialIcon name="lock" className="text-6xl" />
                        <p className="text-sm">Enroll to access this course</p>
                        <Button onClick={handleEnroll} isLoading={enrolling}>
                          {course.price === 0 ? 'Enroll Free' : 'Subscribe'}
                        </Button>
                      </>
                    ) : !hasFullAccess && !activeLesson?.isFreePreview ? (
                      <>
                        <MaterialIcon name="credit_card" className="text-6xl" />
                        <p className="text-sm">Full access required for this lesson</p>
                        <p className="text-xs opacity-70">Contact your teacher or admin to unlock</p>
                      </>
                    ) : (
                      <>
                        <MaterialIcon name="play_circle" className="text-6xl" />
                        <p className="text-sm">No video for this lesson yet</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Active lesson info */}
              {activeLesson && (
                <div className="ui-surface border ui-border rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold ui-text-primary">{activeLesson.title}</h2>
                      {activeLesson.description && (
                        <p className="text-sm ui-text-secondary mt-1">{activeLesson.description}</p>
                      )}
                    </div>
                    {(hasFullAccess || activeLesson.isFreePreview) && !lessonProgress(activeLesson.id)?.completed && (
                      <Button size="sm" variant="secondary" onClick={() => handleMarkComplete(activeLesson.id)}>
                        <span className="inline-flex items-center gap-1"><MaterialIcon name="task_alt" className="text-[14px]" /> Mark Complete</span>
                      </Button>
                    )}
                    {lessonProgress(activeLesson.id)?.completed && (
                      <span className="text-xs text-emerald-600 font-medium shrink-0 inline-flex items-center gap-1"><MaterialIcon name="check_circle" className="text-[14px]" /> Completed</span>
                    )}
                  </div>

                  {/* Course progress */}
                  <div>
                    <div className="flex justify-between text-xs ui-text-secondary mb-1">
                      <span>Course Progress: {completedCount}/{totalLessons} lessons</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-(--border) overflow-hidden">
                      <div className="h-full bg-(--accent) transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Course info */}
              <div className="ui-surface border ui-border rounded-xl p-4 space-y-2">
                <h1 className="text-lg font-bold ui-text-primary">{course.title}</h1>
                <p className="text-xs ui-text-secondary">
                  by {[course.teacher.firstName, course.teacher.lastName].filter(Boolean).join(' ') || 'Instructor'}
                  {' · '}{course._count.enrollments} students
                </p>
                {course.description && <p className="text-sm ui-text-secondary">{course.description}</p>}
              </div>

              {/* Rating section */}
              {hasFullAccess && !ratingSubmitted && (
                <div className="ui-surface border ui-border rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold ui-text-primary">Rate this course</h3>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button
                        key={s}
                        onClick={() => setRating(s)}
                        className={`inline-flex ${s <= rating ? 'text-amber-400' : 'text-gray-300'} transition-colors`}
                      >
                        <MaterialIcon name="star" filled={s <= rating} className="text-[28px]" />
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="ui-input resize-y text-sm"
                    placeholder="Write a review (optional)"
                    value={review}
                    onChange={e => setReview(e.target.value)}
                    rows={2}
                  />
                  <Button size="sm" onClick={handleSubmitRating} isLoading={submittingRating} disabled={rating === 0}>
                    Submit Rating
                  </Button>
                </div>
              )}
              {ratingSubmitted && (
                <p className="text-sm text-emerald-600 font-medium inline-flex items-center gap-1">
                  <MaterialIcon name="star" className="text-[16px]" />
                  Thanks for your rating!
                </p>
              )}

              {/* Reviews */}
              {course.ratings.length > 0 && (
                <div className="ui-surface border ui-border rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold ui-text-primary">Student Reviews</h3>
                  {course.ratings.map((r, i) => (
                    <div key={i} className="border-t ui-border pt-3 first:border-0 first:pt-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium ui-text-primary">
                          {r.student.firstName} {r.student.lastName}
                        </span>
                        <span className="text-amber-400 inline-flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <MaterialIcon key={i} name="star" filled={i < r.rating} className="text-[14px]" />
                          ))}
                        </span>
                      </div>
                      {r.review && <p className="text-xs ui-text-secondary mt-1">{r.review}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar: Lesson List */}
            <div className="w-full lg:w-72 shrink-0">
              <div className="ui-surface border ui-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b ui-border">
                  <h3 className="text-sm font-semibold ui-text-primary">Course Content</h3>
                  <p className="text-xs ui-text-secondary">{totalLessons} lessons · {formatDuration(course.totalDuration)}</p>
                </div>
                <div className="divide-y ui-border max-h-[60vh] overflow-y-auto">
                  {course.lessons.map((lesson, idx) => {
                    const lp = lessonProgress(lesson.id)
                    const isActive = lesson.id === activeLessonId
                    const canAccess = hasFullAccess || lesson.isFreePreview || !!enrollment
                    const isLocked = !canAccess

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => !isLocked && setActiveLessonId(lesson.id)}
                        disabled={isLocked}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
                          ${isActive ? 'bg-(--accent-soft)' : 'hover:bg-(--surface-soft)'}
                          ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span className="text-xs ui-text-secondary w-5 shrink-0 pt-0.5">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium leading-snug ${isActive ? 'text-(--accent)' : 'ui-text-primary'}`}>
                            {lesson.title}
                          </p>
                          <p className="text-xs ui-text-secondary">
                            {lesson.duration > 0 ? formatDuration(lesson.duration) : ''}
                            {lesson.isFreePreview && ' · Free'}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm inline-flex items-center">
                          <MaterialIcon
                            name={isLocked ? 'lock' : lp?.completed ? 'check_circle' : isActive ? 'play_arrow' : 'radio_button_unchecked'}
                            className="text-[16px]"
                          />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
