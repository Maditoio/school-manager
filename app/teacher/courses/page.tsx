'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
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
  allSchools: boolean
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
  const [allowCrossSchool, setAllowCrossSchool] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '0',
    thumbnailUrl: '',
    allSchools: false,
  })

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'TEACHER') redirect('/login')
  }, [session, status])

  const fetchCourses = useCallback(async () => {
    setLoading(true)
    try {
      const [coursesRes, settingsRes] = await Promise.all([
        fetch('/api/courses?mine=true'),
        fetch('/api/schools/settings'),
      ])
      const coursesData = await coursesRes.json()
      const settingsData = await settingsRes.json()
      setCourses(coursesData.courses ?? [])
      setAllowCrossSchool(settingsData.allowCrossSchoolCourses ?? false)
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
          allSchools: form.allSchools,
        }),
      })
      const data = await res.json()
      if (!res.ok) { showAlert({ title: 'Error', message: data.error }); return }
      setShowCreate(false)
      setForm({ title: '', description: '', price: '0', thumbnailUrl: '', allSchools: false })
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
          <Button onClick={() => setShowCreate(true)}>
            <span className="inline-flex items-center gap-1.5">
              <MaterialIcon name="add" className="text-[18px]" />
              New Course
            </span>
          </Button>
        </div>

        {/* Create Course Modal */}
        {showCreate && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); setForm({ title: '', description: '', price: '0', thumbnailUrl: '', allSchools: false }) } }}
          >
            <div className="ui-surface rounded-2xl border ui-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b ui-border">
                <h2 className="text-base font-semibold ui-text-primary">Create New Course</h2>
                <button
                  onClick={() => { setShowCreate(false); setForm({ title: '', description: '', price: '0', thumbnailUrl: '', allSchools: false }) }}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-(--surface-soft) ui-text-secondary transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
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
                    <div className="w-full h-40 rounded-xl overflow-hidden border ui-border mb-3">
                      <img src={form.thumbnailUrl} alt="thumbnail" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <label className="cursor-pointer flex items-center gap-2 h-9 px-3 rounded-lg border ui-border text-sm ui-text-secondary hover:bg-(--surface-soft) transition-colors w-fit">
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleThumbnailUpload} className="hidden" disabled={thumbnailUploading} />
                    {thumbnailUploading ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MaterialIcon name="hourglass_top" className="text-[16px]" />
                        Uploading...
                      </span>
                    ) : form.thumbnailUrl ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MaterialIcon name="sync" className="text-[16px]" />
                        Change Thumbnail
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <MaterialIcon name="add_photo_alternate" className="text-[16px]" />
                        Upload Thumbnail
                      </span>
                    )}
                  </label>
                </div>

                {/* Visibility — only shown if admin has enabled cross-school sharing */}
                {allowCrossSchool && (
                  <div className="p-4 rounded-lg border ui-border bg-(--surface-soft) space-y-1">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        role="switch"
                        aria-checked={form.allSchools}
                        onClick={() => setForm(f => ({ ...f, allSchools: !f.allSchools }))}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${form.allSchools ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form.allSchools ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-sm font-medium ui-text-primary">Share across all schools</span>
                    </label>
                    <p className="text-xs ui-text-secondary pl-12">
                      {form.allSchools ? 'Students from all schools can find and enroll in this course.' : 'Only students at your school can see this course.'}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 px-6 py-4 border-t ui-border">
                <Button onClick={handleCreateCourse} isLoading={saving}>Create Course</Button>
                <Button variant="ghost" onClick={() => { setShowCreate(false); setForm({ title: '', description: '', price: '0', thumbnailUrl: '', allSchools: false }) }}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* Course List */}
        {loading ? (
          <div className="text-center py-12 ui-text-secondary text-sm">Loading courses…</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16 ui-text-secondary">
            <div className="mb-3">
              <MaterialIcon name="play_circle" className="text-5xl" />
            </div>
            <p className="font-medium ui-text-primary">No courses yet</p>
            <p className="text-sm mt-1">Create your first course to get started</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map(course => (
              <div key={course.id} className="group ui-surface border ui-border rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col">
                {/* Thumbnail */}
                <div className="h-44 relative overflow-hidden bg-(--surface-soft) shrink-0">
                  {course.thumbnailUrl ? (
                    <img
                      src={course.thumbnailUrl}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 ui-text-secondary">
                      <MaterialIcon name="play_circle" className="text-5xl" />
                      <span className="text-xs">No thumbnail</span>
                    </div>
                  )}
                  <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-semibold shadow ${course.published ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                    {course.published ? 'Published' : 'Draft'}
                  </span>
                  {course.allSchools && (
                    <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-semibold shadow bg-blue-600 text-white inline-flex items-center gap-1">
                      <MaterialIcon name="public" className="text-[14px]" />
                      All Schools
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col flex-1 gap-2">
                  <div>
                    <h3 className="font-semibold ui-text-primary leading-tight line-clamp-2">{course.title}</h3>
                    {course.description && (
                      <p className="text-xs ui-text-secondary line-clamp-2 mt-1">{course.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs ui-text-secondary mt-auto pt-1">
                    <span className="inline-flex items-center gap-1"><MaterialIcon name="video_library" className="text-[14px]" /> {course.lessons.length} lessons</span>
                    {course.totalDuration > 0 && <span className="inline-flex items-center gap-1"><MaterialIcon name="schedule" className="text-[14px]" /> {formatDuration(course.totalDuration)}</span>}
                    <span className="inline-flex items-center gap-1"><MaterialIcon name="group" className="text-[14px]" /> {course._count.enrollments} enrolled</span>
                    {avgRating(course.ratings) && <span className="inline-flex items-center gap-1"><MaterialIcon name="star" className="text-[14px]" /> {avgRating(course.ratings)}</span>}
                    <span className="font-medium ui-text-primary">{course.price === 0 ? 'Free' : `$${course.price}`}</span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t ui-border">
                    <Button size="sm" variant="secondary" onClick={() => router.push(`/teacher/courses/${course.id}`)}>
                      Manage
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => togglePublish(course)}>
                      {course.published ? 'Unpublish' : 'Publish'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
