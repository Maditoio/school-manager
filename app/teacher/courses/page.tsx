'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'
import { useAlert } from '@/lib/useAlertDialog'

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
  createdAt: string
  lessons: Lesson[]
  _count: { enrollments: number; ratings: number }
  ratings: Array<{ rating: number }>
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function avgRating(ratings: Array<{ rating: number }>) {
  if (!ratings.length) return null
  return (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
}

export default function TeacherCoursesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showAlert } = useAlert()

  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [thumbnailUploading, setThumbnailUploading] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '0',
    thumbnailUrl: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'TEACHER') redirect('/login')
  }, [session, status])

  const fetchCourses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/courses?mine=true')
      const data = await res.json()
      setCourses(data.courses ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') fetchCourses()
  }, [status, fetchCourses])

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
      setForm(f => ({ ...f, thumbnailUrl: data.url }))
    } finally {
      setThumbnailUploading(false)
    }
  }

  async function handleCreateCourse() {
    if (!form.title.trim()) { showAlert({ title: 'Error', message: 'Title is required' }); return }
    setSaving(true)
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          price: parseFloat(form.price) || 0,
          thumbnailUrl: form.thumbnailUrl || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { showAlert({ title: 'Error', message: data.error }); return }
      setShowCreate(false)
      setForm({ title: '', description: '', price: '0', thumbnailUrl: '' })
      fetchCourses()
    } finally {
      setSaving(false)
    }
  }

  async function togglePublish(course: Course) {
    const res = await fetch(`/api/courses/${course.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !course.published }),
    })
    if (res.ok) fetchCourses()
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
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold ui-text-primary">My Courses</h1>
            <p className="text-sm ui-text-secondary mt-0.5">Manage your video courses for students</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>+ New Course</Button>
        </div>

        {/* Create Course Form */}
        {showCreate && (
          <Card title="Create New Course">
            <div className="space-y-4">
              <Input
                label="Course Title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Introduction to Algebra"
              />
              <div>
                <label className="block text-sm font-medium ui-text-secondary mb-2">Description</label>
                <textarea
                  className="ui-input min-h-20 resize-y"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What will students learn?"
                />
              </div>
              <Input
                label="Price (0 = free)"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              />
              <div>
                <label className="block text-sm font-medium ui-text-secondary mb-2">Thumbnail</label>
                {form.thumbnailUrl && (
                  <img src={form.thumbnailUrl} alt="thumbnail" className="w-32 h-20 object-cover rounded-lg mb-2 border ui-border" />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleThumbnailUpload}
                  className="text-sm ui-text-secondary"
                />
                {thumbnailUploading && <p className="text-xs ui-text-secondary mt-1">Uploading…</p>}
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleCreateCourse} isLoading={saving}>Create Course</Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        )}

        {/* Course List */}
        {loading ? (
          <div className="text-center py-12 ui-text-secondary text-sm">Loading courses…</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16 ui-text-secondary">
            <div className="text-4xl mb-3">🎬</div>
            <p className="font-medium ui-text-primary">No courses yet</p>
            <p className="text-sm mt-1">Create your first course to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map(course => (
              <Card key={course.id}>
                {course.thumbnailUrl && (
                  <img
                    src={course.thumbnailUrl}
                    alt={course.title}
                    className="w-full h-36 object-cover rounded-t-lg -mx-4 -mt-4 mb-3"
                    style={{ width: 'calc(100% + 2rem)' }}
                  />
                )}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold ui-text-primary leading-tight">{course.title}</h3>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${course.published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {course.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  {course.description && (
                    <p className="text-xs ui-text-secondary line-clamp-2">{course.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs ui-text-secondary pt-1">
                    <span>📹 {course.lessons.length} lessons</span>
                    {course.totalDuration > 0 && <span>⏱ {formatDuration(course.totalDuration)}</span>}
                    <span>👤 {course._count.enrollments} enrolled</span>
                    {avgRating(course.ratings) && <span>⭐ {avgRating(course.ratings)}</span>}
                    <span>{course.price === 0 ? '🆓 Free' : `💰 ${course.price}`}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="secondary" onClick={() => router.push(`/teacher/courses/${course.id}`)}>
                      Manage
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => togglePublish(course)}>
                      {course.published ? 'Unpublish' : 'Publish'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
