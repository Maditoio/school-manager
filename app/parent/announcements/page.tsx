'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

interface Announcement {
  id: string
  title: string
  message: string
  createdAt: string
  creator?: { firstName: string; lastName: string }
  type?: 'school' | 'class'
  class?: { name: string }
}

interface Child {
  id: string
  firstName: string
  lastName: string
  class?: { name: string }
}

export default function ParentAnnouncementsPage() {
  const { data: session, status } = useSession()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'PARENT') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session) {
      const fetchChildren = async () => {
        try {
          const res = await fetch('/api/students?parentId=' + session?.user?.id)
          if (res.ok) {
            const data = await res.json()
            const childrenArray = Array.isArray(data.students) ? data.students : []
            setChildren(childrenArray)
            if (childrenArray.length > 0) {
              setSelectedChild(childrenArray[0].id)
            }
          } else {
            setChildren([])
          }
        } catch (error) {
          console.error('Failed to fetch children:', error)
          setChildren([])
        } finally {
          setLoading(false)
        }
      }
      fetchChildren()
    }
  }, [session])

  useEffect(() => {
    if (selectedChild) {
      const fetchAnnouncements = async () => {
        try {
          const res = await fetch(`/api/announcements?childId=${selectedChild}`)
          if (res.ok) {
            const data = await res.json()
            setAnnouncements(Array.isArray(data.announcements) ? data.announcements : [])
          } else {
            setAnnouncements([])
          }
        } catch (error) {
          console.error('Failed to fetch announcements:', error)
          setAnnouncements([])
        }
      }
      fetchAnnouncements()
    }
  }, [selectedChild])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = [
    { label: 'Dashboard', href: '/parent/dashboard', icon: '🏠' },
    { label: 'My Children', href: '/parent/children', icon: '👨‍👩‍👧‍👦' },
    { label: 'Attendance', href: '/parent/attendance', icon: '📅' },
    { label: 'Results', href: '/parent/results', icon: '📊' },
    { label: 'Assessments', href: '/parent/assessments', icon: '📋' },
    { label: 'Announcements', href: '/parent/announcements', icon: '📢' },
    { label: 'Messages', href: '/parent/messages', icon: '💬' },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Parent',
        role: 'Parent',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="min-h-screen bg-linear-to-b from-emerald-50 via-white to-blue-50">
        <div className="mx-auto w-full max-w-md space-y-5 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] px-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Announcements
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Latest News</h1>
          </section>

          {children.length > 1 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="block text-xs font-semibold text-slate-700 mb-2">Select Child</label>
              <select
                value={selectedChild}
                onChange={(e) => setSelectedChild(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-emerald-500"
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.firstName} {child.lastName} - {child.class?.name || 'No class'}
                  </option>
                ))}
              </select>
            </section>
          )}

          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl bg-linear-to-r from-slate-100 to-slate-200 h-24 animate-pulse"></div>
                ))}
              </div>
            </section>
          ) : announcements.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  All Announcements
                </h2>
                <span className="rounded-full bg-linear-to-r from-slate-100 to-slate-50 px-3 py-1 text-xs text-slate-500 border border-slate-200">
                  {announcements.length}
                </span>
              </div>
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <article
                    key={announcement.id}
                    className={`rounded-2xl border p-4 shadow-xs ${
                      announcement.type === 'class'
                        ? 'border-emerald-200 bg-linear-to-br from-emerald-50 to-emerald-50'
                        : 'border-slate-200 bg-linear-to-br from-white to-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">
                            {announcement.title}
                          </h3>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                            announcement.type === 'class'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {announcement.type === 'class' ? '📚 Class' : '🏢 School'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          By {announcement.creator?.firstName} {announcement.creator?.lastName}
                          {announcement.type === 'class' && announcement.class && (
                            <span className="ml-2 text-emerald-600">• {announcement.class.name}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {announcement.message}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      📅 {formatDate(announcement.createdAt)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-linear-to-br from-slate-50 to-slate-100 p-6 text-center">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-sm text-slate-600">No announcements yet</p>
            </section>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
