'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

interface ClassAnnouncement {
  id: string
  title: string
  message: string
  createdAt: string
  creator?: { firstName: string; lastName: string }
}

interface TeacherClass {
  id: string
  name: string
}

export default function TeacherAnnouncementsPage() {
  const { data: session, status } = useSession()
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [announcements, setAnnouncements] = useState<ClassAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [announcementsLoading, setAnnouncementsLoading] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'TEACHER') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session) {
      const fetchClasses = async () => {
        try {
          const res = await fetch(`/api/classes?teacherId=${session.user.id}`)
          if (res.ok) {
            const data = await res.json()
            const classesArray = Array.isArray(data.classes) ? data.classes : []
            setClasses(classesArray)
            if (classesArray.length > 0) {
              setSelectedClass(classesArray[0].id)
            }
          } else {
            setClasses([])
          }
        } catch (error) {
          console.error('Failed to fetch classes:', error)
          setClasses([])
        } finally {
          setLoading(false)
        }
      }
      fetchClasses()
    }
  }, [session])

  useEffect(() => {
    if (selectedClass) {
      setAnnouncementsLoading(true)
      const fetchAnnouncements = async () => {
        try {
          const res = await fetch(`/api/class-announcements?classId=${selectedClass}`)
          if (res.ok) {
            const data = await res.json()
            setAnnouncements(Array.isArray(data.classAnnouncements) ? data.classAnnouncements : [])
          } else {
            setAnnouncements([])
          }
        } catch (error) {
          console.error('Failed to fetch announcements:', error)
          setAnnouncements([])
        } finally {
          setAnnouncementsLoading(false)
        }
      }
      fetchAnnouncements()
    }
  }, [selectedClass])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim() || !selectedClass) {
      setSubmitError('Please fill in all fields')
      return
    }

    setFormLoading(true)
    setSubmitError('')
    setSubmitSuccess(false)

    try {
      const res = await fetch('/api/class-announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          classId: selectedClass,
          priority: 'normal',
        }),
      })

      if (res.ok) {
        setTitle('')
        setMessage('')
        setSubmitSuccess(true)
        // Refresh announcements
        const announcementsRes = await fetch(`/api/class-announcements?classId=${selectedClass}`)
        if (announcementsRes.ok) {
          const data = await announcementsRes.json()
          setAnnouncements(Array.isArray(data.classAnnouncements) ? data.classAnnouncements : [])
        }
        setTimeout(() => setSubmitSuccess(false), 3000)
      } else {
        const error = await res.json()
        setSubmitError(error.error || 'Failed to create announcement')
      }
    } catch (error) {
      console.error('Error creating announcement:', error)
      setSubmitError('Failed to create announcement')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (announcementId: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) {
      return
    }

    try {
      const res = await fetch(`/api/class-announcements/${announcementId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setAnnouncements(announcements.filter((a) => a.id !== announcementId))
      }
    } catch (error) {
      console.error('Error deleting announcement:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = [
    { label: 'Dashboard', href: '/teacher/dashboard', icon: '📊' },
    { label: 'My Classes', href: '/teacher/classes', icon: '🏫' },
    { label: 'Students', href: '/teacher/students', icon: '👨‍🎓' },
    { label: 'Assessments', href: '/teacher/assessments', icon: '📋' },
    { label: 'Attendance', href: '/teacher/attendance', icon: '📅' },
    { label: 'Results', href: '/teacher/results', icon: '📝' },
    { label: 'Announcements', href: '/teacher/announcements', icon: '📢' },
    { label: 'Messages', href: '/teacher/messages', icon: '💬' },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Teacher',
        role: 'Teacher',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-6xl space-y-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 px-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Class Announcements</h1>
            <p className="text-gray-700 mt-2">Create and manage announcements for your classes</p>
          </div>

          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-xl bg-linear-to-r from-slate-100 to-slate-200 h-12 animate-pulse"></div>
                ))}
              </div>
            </section>
          ) : classes.length > 0 ? (
            <>
              {/* Class Selector */}
              <div className="bg-white rounded-lg shadow p-6">
                <label className="block text-sm font-semibold text-gray-900 mb-3">Select Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Create Announcement Form */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Create New Announcement</h2>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Title
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter announcement title"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={formLoading}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Message
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Enter announcement message"
                        rows={5}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        disabled={formLoading}
                      />
                    </div>

                    {submitError && (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                        <p className="text-sm text-red-700 font-medium">⚠️ {submitError}</p>
                      </div>
                    )}

                    {submitSuccess && (
                      <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                        <p className="text-sm text-green-700 font-medium">✓ Announcement created successfully</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={formLoading || !title.trim() || !message.trim()}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {formLoading ? '⏳ Creating...' : '✓ Create Announcement'}
                    </button>
                  </form>
                </div>

                {/* Announcements List */}
                {announcementsLoading ? (
                  <div className="bg-white rounded-lg shadow p-8">
                    <div className="space-y-4">
                      {[1, 2].map((i) => (
                        <div key={i} className="rounded-lg bg-gray-100 h-20 animate-pulse"></div>
                      ))}
                    </div>
                  </div>
                ) : announcements.length > 0 ? (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">Your Announcements</h2>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        {announcements.length}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {announcements.map((announcement) => (
                        <article
                          key={announcement.id}
                          className="p-6 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <h3 className="text-base font-semibold text-gray-900 line-clamp-2 flex-1">
                              {announcement.title}
                            </h3>
                            <button
                              onClick={() => handleDelete(announcement.id)}
                              className="text-red-600 hover:text-red-700 font-bold shrink-0 text-lg"
                            >
                              ✕
                            </button>
                          </div>
                          <p className="text-gray-800 text-sm line-clamp-3 leading-relaxed mb-3">
                            {announcement.message}
                          </p>
                          <p className="text-xs text-gray-600">
                            {formatDate(announcement.createdAt)}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow p-12 text-center">
                    <div className="text-5xl mb-4">📭</div>
                    <p className="text-gray-700">No announcements yet. Create one above!</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-5xl mb-4">📚</div>
              <p className="text-gray-700">No classes assigned yet</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
