'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { upload } from '@vercel/blob/client'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'
import { useAlert } from '@/lib/useAlertDialog'
import { useConfirmDialog } from '@/lib/useConfirmDialog'

interface Lesson {
  id: string
  title: string
  description: string | null
  videoUrl: string | null
  duration: number
  lessonOrder: number
  isFreePreview: boolean
}

interface Course {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  price: number
  published: boolean
  totalDuration: number
  lessons: Lesson[]
  _count: { enrollments: number; ratings: number }
  ratings: Array<{ rating: number }>
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function TeacherCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showAlert } = useAlert()
  const { confirm } = useConfirmDialog()

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingCourse, setEditingCourse] = useState(false)
  const [courseForm, setCourseForm] = useState({ title: '', description: '', price: '0', thumbnailUrl: '' })
  const [savingCourse, setSavingCourse] = useState(false)
  const [thumbnailUploading, setThumbnailUploading] = useState(false)

  const [showAddLesson, setShowAddLesson] = useState(false)
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', isFreePreview: false })
  const [savingLesson, setSavingLesson] = useState(false)
  const [videoUploading, setVideoUploading] = useState<string | null>(null) // lessonId or 'new'
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'TEACHER') redirect('/login')
  }, [session, status])

  const fetchCourse = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/courses/${courseId}`)
      if (!res.ok) { router.push('/teacher/courses'); return }
      const data = await res.json()
      setCourse(data.course)
      setCourseForm({
        title: data.course.title,
        description: data.course.description ?? '',
        price: String(data.course.price),
        thumbnailUrl: data.course.thumbnailUrl ?? '',
      })
    } finally {
      setLoading(false)
    }
  }, [courseId, router])

  useEffect(() => {
    if (status === 'authenticated') fetchCourse()
  }, [status, fetchCourse])

  async function handleThumbnailUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setThumbnailUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/courses/upload-thumbnail', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { showAlert({ title: 'Upload failed', message: data.error }); return }
      setCourseForm(f => ({ ...f, thumbnailUrl: data.url }))
    } finally {
      setThumbnailUploading(false)
    }
  }

  async function handleSaveCourse() {
    if (!courseForm.title.trim()) { showAlert({ title: 'Error', message: 'Title is required' }); return }
    setSavingCourse(true)
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: courseForm.title,
          description: courseForm.description,
          price: parseFloat(courseForm.price) || 0,
          thumbnailUrl: courseForm.thumbnailUrl || null,
        }),
      })
      if (res.ok) { setEditingCourse(false); fetchCourse() }
    } finally {
      setSavingCourse(false)
    }
  }

  async function handleVideoUpload(file: File, lessonId: string | 'new', onUrl: (url: string) => void) {
    setVideoUploading(lessonId)
    setUploadProgress(0)
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/courses/upload-video-client',
        clientPayload: JSON.stringify({ courseId }),
        multipart: true,
        onUploadProgress: (event) => {
          setUploadProgress(Math.round(event.percentage))
        },
      })

      onUrl(blob.url)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await showAlert({ title: 'Upload failed', message })
    } finally {
      setVideoUploading(null)
      setUploadProgress(0)
    }
  }

  async function handleAddLesson() {
    if (!lessonForm.title.trim()) { showAlert({ title: 'Error', message: 'Lesson title is required' }); return }
    setSavingLesson(true)
    try {
      const res = await fetch(`/api/courses/${courseId}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: lessonForm.title,
          description: lessonForm.description,
          isFreePreview: lessonForm.isFreePreview,
        }),
      })
      if (res.ok) {
        setShowAddLesson(false)
        setLessonForm({ title: '', description: '', isFreePreview: false })
        fetchCourse()
      }
    } finally {
      setSavingLesson(false)
    }
  }

  async function handleDeleteLesson(lessonId: string) {
    const ok = await confirm({ title: 'Delete lesson?', description: 'This will remove the lesson and all student progress for it.' })
    if (!ok) return
    await fetch(`/api/courses/${courseId}/lessons/${lessonId}`, { method: 'DELETE' })
    fetchCourse()
  }

  async function handleToggleFreePreview(lesson: Lesson) {
    await fetch(`/api/courses/${courseId}/lessons/${lesson.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFreePreview: !lesson.isFreePreview }),
    })
    fetchCourse()
  }

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
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/teacher/courses')}>← Back</Button>
          <h1 className="text-xl font-bold ui-text-primary">{course?.title ?? 'Loading…'}</h1>
        </div>

        {loading ? (
          <div className="text-center py-12 ui-text-secondary text-sm">Loading…</div>
        ) : !course ? null : (
          <>
            {/* Course Info */}
            <Card title="Course Details" action={
              <Button size="sm" variant="secondary" onClick={() => setEditingCourse(e => !e)}>
                {editingCourse ? 'Cancel' : 'Edit'}
              </Button>
            }>
              {editingCourse ? (
                <div className="space-y-4">
                  <Input label="Title" value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))} />
                  <div>
                    <label className="block text-sm font-medium ui-text-secondary mb-2">Description</label>
                    <textarea
                      className="ui-input min-h-20 resize-y"
                      value={courseForm.description}
                      onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <Input label="Price (0 = free)" type="number" min="0" step="0.01" value={courseForm.price}
                    onChange={e => setCourseForm(f => ({ ...f, price: e.target.value }))} />
                  <div>
                    <label className="block text-sm font-medium ui-text-secondary mb-2">Thumbnail</label>
                    {courseForm.thumbnailUrl && (
                      <img src={courseForm.thumbnailUrl} alt="thumb" className="w-32 h-20 object-cover rounded-lg mb-2 border ui-border" />
                    )}
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleThumbnailUpload} className="text-sm" />
                    {thumbnailUploading && <p className="text-xs ui-text-secondary mt-1">Uploading thumbnail…</p>}
                  </div>
                  <Button onClick={handleSaveCourse} isLoading={savingCourse}>Save Changes</Button>
                </div>
              ) : (
                <div className="flex gap-4">
                  {course.thumbnailUrl && (
                    <img src={course.thumbnailUrl} alt={course.title} className="w-32 h-20 object-cover rounded-lg border ui-border shrink-0" />
                  )}
                  <div className="space-y-1">
                    {course.description && <p className="text-sm ui-text-secondary">{course.description}</p>}
                    <div className="flex flex-wrap gap-4 text-sm pt-1">
                      <span className="ui-text-secondary">Price: <strong className="ui-text-primary">{course.price === 0 ? 'Free' : `${course.price}`}</strong></span>
                      <span className="ui-text-secondary">Enrolled: <strong className="ui-text-primary">{course._count.enrollments}</strong></span>
                      {course.ratings.length > 0 && (
                        <span className="ui-text-secondary">Avg Rating: <strong className="ui-text-primary">
                          {(course.ratings.reduce((s, r) => s + r.rating, 0) / course.ratings.length).toFixed(1)} ⭐
                        </strong></span>
                      )}
                      <span className={`font-medium ${course.published ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {course.published ? '✅ Published' : '⚠️ Draft'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Lessons */}
            <Card
              title={`Lessons (${course.lessons.length})`}
              action={<Button size="sm" onClick={() => setShowAddLesson(s => !s)}>+ Add Lesson</Button>}
            >
              {showAddLesson && (
                <div className="mb-6 p-4 rounded-lg border ui-border bg-(--surface-soft) space-y-3">
                  <h4 className="text-sm font-semibold ui-text-primary">New Lesson</h4>
                  <Input label="Lesson Title" value={lessonForm.title}
                    onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} />
                  <div>
                    <label className="block text-sm font-medium ui-text-secondary mb-2">Description (optional)</label>
                    <textarea className="ui-input resize-y" value={lessonForm.description}
                      onChange={e => setLessonForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-2 text-sm ui-text-secondary cursor-pointer">
                    <input type="checkbox" checked={lessonForm.isFreePreview}
                      onChange={e => setLessonForm(f => ({ ...f, isFreePreview: e.target.checked }))} />
                    Free preview (visible without payment)
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddLesson} isLoading={savingLesson}>Add Lesson</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowAddLesson(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {course.lessons.length === 0 ? (
                <p className="text-sm ui-text-secondary text-center py-6">No lessons yet. Add your first lesson above.</p>
              ) : (
                <div className="space-y-3">
                  {course.lessons.map((lesson, idx) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      index={idx}
                      courseId={courseId}
                      videoUploading={videoUploading}
                      uploadProgress={uploadProgress}
                      onVideoUpload={handleVideoUpload}
                      onToggleFreePreview={handleToggleFreePreview}
                      onDelete={handleDeleteLesson}
                      onRefresh={fetchCourse}
                    />
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

function LessonRow({
  lesson,
  index,
  courseId,
  videoUploading,
  uploadProgress,
  onVideoUpload,
  onToggleFreePreview,
  onDelete,
  onRefresh,
}: {
  lesson: Lesson
  index: number
  courseId: string
  videoUploading: string | null
  uploadProgress: number
  onVideoUpload: (file: File, lessonId: string, onUrl: (url: string) => void) => Promise<void>
  onToggleFreePreview: (lesson: Lesson) => void
  onDelete: (lessonId: string) => void
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isUploading = videoUploading === lesson.id

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await onVideoUpload(file, lesson.id, async (url) => {
      // Get video duration via HTML5
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.src = url
      const duration = await new Promise<number>(resolve => {
        video.onloadedmetadata = () => resolve(Math.round(video.duration))
        video.onerror = () => resolve(0)
        setTimeout(() => resolve(0), 5000)
      })
      await fetch(`/api/courses/${courseId}/lessons/${lesson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: url, duration }),
      })
      onRefresh()
    })
  }

  return (
    <div className="border ui-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-(--surface-soft) transition-colors"
      >
        <span className="text-xs ui-text-secondary w-5 shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium ui-text-primary truncate">{lesson.title}</p>
          <p className="text-xs ui-text-secondary">
            {lesson.videoUrl ? `✅ Video uploaded · ${formatDuration(lesson.duration)}` : '⚠️ No video'}
            {lesson.isFreePreview && ' · 🆓 Free preview'}
          </p>
        </div>
        <span className="text-xs ui-text-secondary">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t ui-border bg-(--surface-soft) space-y-3">
          {lesson.description && <p className="text-xs ui-text-secondary">{lesson.description}</p>}

          {lesson.videoUrl ? (
            <div className="space-y-2">
              <video
                src={lesson.videoUrl}
                controls
                className="w-full max-h-48 rounded-lg bg-black"
              />
              <p className="text-xs ui-text-secondary">Duration: {formatDuration(lesson.duration)}</p>
            </div>
          ) : (
            <p className="text-xs text-amber-600">No video uploaded yet.</p>
          )}

          {isUploading && (
            <div>
              <p className="text-xs ui-text-secondary mb-1">Uploading… {uploadProgress}%</p>
              <div className="h-2 rounded-full bg-(--border) overflow-hidden">
                <div className="h-full bg-(--accent) transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <label className="cursor-pointer">
              <input type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={handleFileSelect} disabled={!!videoUploading} />
              <span className="inline-flex items-center h-7 px-3 rounded text-xs font-medium ui-button-secondary cursor-pointer">
                {lesson.videoUrl ? '🔄 Replace Video' : '📤 Upload Video'}
              </span>
            </label>
            <Button size="sm" variant="ghost" onClick={() => onToggleFreePreview(lesson)}>
              {lesson.isFreePreview ? 'Remove Free Preview' : 'Set Free Preview'}
            </Button>
            <Button size="sm" variant="danger" onClick={() => onDelete(lesson.id)}>Delete</Button>
          </div>

          <p className="text-xs ui-text-secondary">
            Supported: MP4, MOV, WebM · Max 2 GB
          </p>
        </div>
      )}
    </div>
  )
}
