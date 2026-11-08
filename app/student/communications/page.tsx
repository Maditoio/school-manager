'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'
import { useStudentUi } from '@/lib/use-student-ui'

interface Announcement {
  id: string
  title: string
  message: string
  imageUrl?: string | null
  priority: string
  createdAt: string
  type: 'school' | 'class'
  creator?: { firstName: string; lastName: string; role: string }
  class?: { name: string } | null
}

const priorityStyle: Record<string, { badge: string; border: string }> = {
  high:   { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',    border: 'border-l-4 border-l-red-400' },
  normal: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', border: '' },
  low:    { badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',    border: '' },
}

export default function StudentCommunicationsPage() {
  const { data: session, status } = useSession()
  const { locale, tStudent } = useStudentUi()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'school' | 'class'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'STUDENT') redirect('/login')
  }, [session, status])

  useEffect(() => {
    if (!session?.user) return
    setLoading(true)
    fetch('/api/student/announcements')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.announcements)) setAnnouncements(data.announcements)
        else setError(data.error || tStudent('loadError', 'Failed to load'))
      })
      .catch(() => setError(tStudent('loadError', 'Failed to load')))
      .finally(() => setLoading(false))
  }, [session?.user?.id, tStudent])

  if (status === 'loading' || !session) return null

  const priorityLabels: Record<string, string> = {
    high: tStudent('priorityUrgent', 'Urgent'),
    normal: tStudent('priorityNormal', 'Normal'),
    low: tStudent('priorityInfo', 'Info'),
  }

  const roleLabels: Record<string, string> = {
    SCHOOL_ADMIN: tStudent('roleDirection', 'Administration'),
    DEPUTY_ADMIN: tStudent('roleDeputy', 'Deputy admin'),
    TEACHER: tStudent('roleTeacher', 'Teacher'),
    SUPER_ADMIN: tStudent('roleSuperAdmin', 'Super Admin'),
  }

  const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)
    const days = Math.floor(diff / 86_400_000)
    const dateLocale = locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-TZ' : 'en-GB'
    if (mins < 1) return tStudent('justNow', 'just now')
    if (mins < 60) return tStudent('minutesAgo', '{count} min ago', { count: mins })
    if (hours < 24) return tStudent('hoursAgo', '{count} h ago', { count: hours })
    if (days < 7) return tStudent('daysAgo', '{count} d ago', { count: days })
    return new Date(dateStr).toLocaleDateString(dateLocale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const filtered = filter === 'all' ? announcements : announcements.filter(a => a.type === filter)
  const schoolCount = announcements.filter(a => a.type === 'school').length
  const classCount = announcements.filter(a => a.type === 'class').length
  const dateLocale = locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-TZ' : 'en-GB'

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Student',
        role: 'Student',
        email: session.user.email,
      }}
      navItems={STUDENT_NAV_ITEMS}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold ui-text-primary">
            {tStudent('communications', 'Communications')}
          </h1>
          <p className="text-sm ui-text-secondary mt-0.5">
            {tStudent('communicationsSubtitle', 'Announcements from your school and class')}
          </p>
        </div>

        <div className="flex items-center gap-1 border-b ui-border">
          {([
            { key: 'all' as const, label: tStudent('filterAll', 'All ({count})', { count: announcements.length }) },
            { key: 'school' as const, label: tStudent('filterSchool', 'School ({count})', { count: schoolCount }) },
            { key: 'class' as const, label: tStudent('filterClass', 'Class ({count})', { count: classCount }) },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                filter === tab.key
                  ? 'border-(--accent) text-(--accent)'
                  : 'border-transparent ui-text-secondary hover:ui-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="ui-surface p-6 flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent)" />
            <p className="text-sm ui-text-secondary">
              {tStudent('loadingAnnouncements', 'Loading...')}
            </p>
          </div>
        ) : error ? (
          <div className="ui-surface p-5">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ui-surface p-10 text-center">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-sm ui-text-secondary">
              {tStudent('noAnnouncements', 'No announcements yet.')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ann => {
              const ps = priorityStyle[ann.priority] ?? priorityStyle.normal
              const isExp = expandedId === ann.id
              return (
                <div
                  key={ann.id}
                  className={`ui-surface overflow-hidden ${ps.border}`}
                >
                  <button
                    onClick={() => setExpandedId(isExp ? null : ann.id)}
                    className="w-full text-left p-4 flex items-start gap-3 hover:opacity-80 transition-opacity"
                  >
                    <span className="text-xl shrink-0 mt-0.5">
                      {ann.type === 'class' ? '🏫' : '📢'}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-sm font-semibold ui-text-primary leading-tight">
                          {ann.title}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ps.badge}`}>
                          {priorityLabels[ann.priority] ?? ann.priority}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          ann.type === 'class'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                        }`}>
                          {ann.type === 'class'
                            ? (ann.class?.name ?? tStudent('classFallback', 'Class'))
                            : tStudent('schoolLabel', 'School')}
                        </span>
                      </div>

                      {!isExp && (
                        <p className="text-xs ui-text-secondary line-clamp-2">{ann.message}</p>
                      )}

                      <div className="mt-1.5 flex items-center gap-2 text-[11px] ui-text-secondary">
                        {ann.creator && (
                          <span>
                            {ann.creator.firstName} {ann.creator.lastName}
                            {' · '}{roleLabels[ann.creator.role] ?? ann.creator.role}
                          </span>
                        )}
                        <span>·</span>
                        <span>{timeAgo(ann.createdAt)}</span>
                      </div>
                    </div>

                    {!isExp && ann.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ann.imageUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-[6px] object-cover"
                      />
                    ) : null}

                    <span className="text-xs ui-text-secondary shrink-0 mt-1">
                      {isExp ? '▲' : '▼'}
                    </span>
                  </button>

                  {isExp && (
                    <div className="px-4 pb-4 pt-1 border-t ui-border">
                      {ann.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ann.imageUrl}
                          alt={ann.title}
                          className="mb-3 h-44 w-full rounded-[6px] object-cover"
                        />
                      ) : null}
                      <p className="text-sm ui-text-primary whitespace-pre-wrap leading-relaxed">
                        {ann.message}
                      </p>
                      <p className="mt-3 text-[11px] ui-text-secondary">
                        {tStudent('publishedOn', 'Published on {date}', {
                          date: new Date(ann.createdAt).toLocaleDateString(dateLocale, {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          }),
                        })}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
