'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'

interface Announcement {
  id: string
  title: string
  message: string
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

const priorityLabels: Record<string, string> = {
  high:   'Urgent',
  normal: 'Normal',
  low:    'Info',
}

const roleLabels: Record<string, string> = {
  SCHOOL_ADMIN: 'Direction',
  DEPUTY_ADMIN: 'Directeur adjoint',
  TEACHER:      'Enseignant',
  SUPER_ADMIN:  'Super Admin',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return "à l'instant"
  if (mins < 60)  return `il y a ${mins} min`
  if (hours < 24) return `il y a ${hours} h`
  if (days < 7)   return `il y a ${days} j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function StudentCommunicationsPage() {
  const { data: session, status } = useSession()
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
        else setError(data.error || 'Erreur lors du chargement')
      })
      .catch(() => setError('Erreur lors du chargement'))
      .finally(() => setLoading(false))
  }, [session?.user?.id])

  if (status === 'loading' || !session) return null

  const filtered = filter === 'all' ? announcements : announcements.filter(a => a.type === filter)
  const schoolCount = announcements.filter(a => a.type === 'school').length
  const classCount  = announcements.filter(a => a.type === 'class').length

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Étudiant',
        role: 'Étudiant',
        email: session.user.email,
      }}
      navItems={STUDENT_NAV_ITEMS}
    >
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold ui-text-primary">Communications</h1>
          <p className="text-sm ui-text-secondary mt-0.5">
            Annonces de l&apos;école et de votre classe
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 border-b ui-border">
          {([
            { key: 'all',    label: `Tout (${announcements.length})` },
            { key: 'school', label: `École (${schoolCount})` },
            { key: 'class',  label: `Classe (${classCount})` },
          ] as const).map(tab => (
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

        {/* Content */}
        {loading ? (
          <div className="ui-surface p-6 flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent)" />
            <p className="text-sm ui-text-secondary">Chargement...</p>
          </div>
        ) : error ? (
          <div className="ui-surface p-5">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ui-surface p-10 text-center">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-sm ui-text-secondary">Aucune annonce pour l&apos;instant.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ann => {
              const ps    = priorityStyle[ann.priority] ?? priorityStyle.normal
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
                    {/* Icon */}
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
                            ? (ann.class?.name ?? 'Classe')
                            : 'École'}
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

                    <span className="text-xs ui-text-secondary shrink-0 mt-1">
                      {isExp ? '▲' : '▼'}
                    </span>
                  </button>

                  {isExp && (
                    <div className="px-4 pb-4 pt-1 border-t ui-border">
                      <p className="text-sm ui-text-primary whitespace-pre-wrap leading-relaxed">
                        {ann.message}
                      </p>
                      <p className="mt-3 text-[11px] ui-text-secondary">
                        Publié le {new Date(ann.createdAt).toLocaleDateString('fr-FR', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
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
