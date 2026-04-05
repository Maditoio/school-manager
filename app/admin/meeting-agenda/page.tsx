'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { AlertTriangle, CheckCircle2, Clock, Info, TrendingUp } from 'lucide-react'
import { ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

const categoryLabels: Record<string, string> = {
  MAINTENANCE: 'Maintenance',
  EQUIPMENT: 'Equipment',
  TRANSPORT: 'Transport',
  REFRESHMENTS: 'Refreshments',
  SPORTS_TRIPS: 'Sports & Trips',
  TRAINING_PROGRAMS: 'Training Programs',
  KITCHEN: 'Kitchen',
  UTILITIES: 'Utilities',
  CLEANING: 'Cleaning',
  SALARIES: 'Salaries',
  BURSARIES: 'Bursaries',
  SPECIAL_DISCOUNTS: 'Special Discounts',
  SOFTWARE_LICENSES: 'Software Licenses',
  OTHER: 'Other',
}

function formatCurrency(value: number) {
  return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type TalkingPoint = {
  id?: string
  title?: string
  amount?: number
  category?: string
  requestedBy?: string
  requestedByRole?: string
  description?: string | null
  requiresAdminApproval?: boolean
  reviewedBy?: string | null
  date?: string
  // for category breakdown
  count?: number
  total?: number
}

type AgendaSection = {
  section: string
  priority: 'high' | 'medium' | 'low' | 'info'
  note?: string
  points: TalkingPoint[]
}

type AgendaData = {
  generatedAt: string
  periodFrom: string
  periodTo: string
  summary: {
    total: number
    pending: number
    approved: number
    rejected: number
    totalRequested: number
    totalApproved: number
    totalPending: number
  }
  talkingPoints: AgendaSection[]
}

const priorityConfig: Record<string, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
  high: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
    label: 'Action Required',
  },
  medium: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: <Clock className="h-4 w-4 text-amber-400" />,
    label: 'For Review',
  },
  low: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    label: 'Completed',
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: <TrendingUp className="h-4 w-4 text-blue-400" />,
    label: 'Overview',
  },
}

const ALLOWED_ROLES = ['SCHOOL_ADMIN', 'FINANCE', 'FINANCE_MANAGER', 'TEACHER']

export default function MeetingAgendaPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [agenda, setAgenda] = useState<AgendaData | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && !ALLOWED_ROLES.includes(session.user.role)) {
      redirect('/admin/dashboard')
    }
  }, [session, status])

  // Default to last 7 days
  useEffect(() => {
    const to = new Date()
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)
    setDateTo(to.toISOString().slice(0, 10))
    setDateFrom(from.toISOString().slice(0, 10))
  }, [])

  const fetchAgenda = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    try {
      setLoading(true)
      const params = new URLSearchParams({ from: dateFrom, to: dateTo })
      const res = await fetch(`/api/meeting-agenda?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to load agenda', 'error')
        return
      }
      setAgenda(data)
    } catch {
      showToast('Failed to load agenda', 'error')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, showToast])

  useEffect(() => {
    if (session?.user?.role && ALLOWED_ROLES.includes(session.user.role) && dateFrom && dateTo) {
      fetchAgenda()
    }
  }, [session?.user?.role, fetchAgenda, dateFrom, dateTo])

  const handlePrint = () => window.print()

  const isAdmin = session?.user?.role === 'SCHOOL_ADMIN'
  const navItems = ADMIN_NAV_ITEMS

  if (status === 'loading' || !session?.user) return <div>Loading...</div>

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'User',
        role: session.user.role?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || '',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-4 print:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-[24px] font-bold ui-text-primary">Meeting Agenda</h1>
            <p className="mt-1 ui-text-secondary">
              Auto-generated talking points from fund requests in the selected period.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={handlePrint}>Print / Export PDF</Button>
            <Button onClick={fetchAgenda} isLoading={loading}>Refresh</Button>
          </div>
        </div>

        {/* Print header — only visible on print */}
        <div className="hidden print:block">
          <h1 className="text-2xl font-bold">School Finance — Meeting Agenda</h1>
          {agenda && (
            <p className="text-sm text-gray-500 mt-1">
              Period: {new Date(agenda.periodFrom).toLocaleDateString()} – {new Date(agenda.periodTo).toLocaleDateString()} ·
              Generated: {new Date(agenda.generatedAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Date range controls */}
        <Card className="p-4 print:hidden">
          <div className="flex flex-wrap items-end gap-3">
            <Input label="Period from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label="Period to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <Button onClick={fetchAgenda} isLoading={loading}>Generate</Button>
          </div>
        </Card>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500/30 border-t-indigo-500" />
          </div>
        )}

        {!loading && agenda && (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Total Requests', value: agenda.summary.total, color: 'text-slate-300' },
                { label: 'Pending Review', value: agenda.summary.pending, color: 'text-amber-400' },
                { label: 'Approved', value: agenda.summary.approved, color: 'text-emerald-400' },
                { label: 'Total Value', value: formatCurrency(agenda.summary.totalRequested), color: 'text-blue-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}>
                  <p className="text-xs uppercase tracking-wide ui-text-secondary">{label}</p>
                  <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {agenda.talkingPoints.length === 0 ? (
              <Card className="p-8 text-center">
                <Info className="mx-auto mb-3 h-8 w-8 ui-text-secondary" />
                <p className="ui-text-secondary">No fund requests found for this period. Nothing to report.</p>
              </Card>
            ) : (
              agenda.talkingPoints.map((section, si) => {
                const cfg = priorityConfig[section.priority] ?? priorityConfig.info
                return (
                  <div
                    key={si}
                    className={`rounded-xl border p-5 ${cfg.bg} ${cfg.border}`}
                  >
                    {/* Section header */}
                    <div className="mb-4 flex items-center gap-2">
                      {cfg.icon}
                      <h2 className="font-semibold ui-text-primary">{section.section}</h2>
                      <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--surface-soft)' }}>
                        {cfg.label}
                      </span>
                    </div>

                    {section.note && (
                      <p className="mb-3 rounded-lg bg-white/5 px-3 py-2 text-sm ui-text-secondary">
                        {section.note}
                      </p>
                    )}

                    {/* Category breakdown (info section) */}
                    {section.priority === 'info' ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        {section.points.map((p, pi) => (
                          <div
                            key={pi}
                            className="flex items-center justify-between rounded-lg px-3 py-2"
                            style={{ background: 'var(--surface-soft)' }}
                          >
                            <span className="text-sm font-medium ui-text-primary">
                              {categoryLabels[p.category ?? ''] ?? p.category}
                            </span>
                            <span className="text-right text-sm">
                              <span className="ui-text-primary font-semibold">{formatCurrency(p.total ?? 0)}</span>
                              <span className="ml-2 ui-text-secondary">({p.count} req)</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Request cards */
                      <ol className="space-y-3">
                        {section.points.map((p, pi) => (
                          <li
                            key={p.id || pi}
                            className="rounded-xl px-4 py-3"
                            style={{ background: 'var(--surface-soft)', borderLeft: '3px solid var(--border-subtle)' }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <span className="mr-2 text-xs font-bold ui-text-secondary">{pi + 1}.</span>
                                <span className="font-semibold ui-text-primary">{p.title}</span>
                                {p.requiresAdminApproval && (
                                  <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                                    Needs Admin Approval
                                  </span>
                                )}
                              </div>
                              {p.amount !== undefined && (
                                <span className="font-bold ui-text-primary">{formatCurrency(p.amount)}</span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs ui-text-secondary">
                              {p.requestedBy && (
                                <span>From: <span className="ui-text-primary">{p.requestedBy}</span></span>
                              )}
                              {p.requestedByRole && (
                                <span>{p.requestedByRole.replace(/_/g, ' ').toLowerCase()}</span>
                              )}
                              {p.category && (
                                <span>Category: <span className="ui-text-primary">{categoryLabels[p.category] ?? p.category}</span></span>
                              )}
                              {p.reviewedBy && (
                                <span>Reviewed by: <span className="ui-text-primary">{p.reviewedBy}</span></span>
                              )}
                              {p.date && (
                                <span>{new Date(p.date).toLocaleDateString()}</span>
                              )}
                            </div>
                            {p.description && (
                              <p className="mt-1.5 text-sm ui-text-secondary">{p.description}</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )
              })
            )}

            {/* Admin-only pending total callout */}
            {isAdmin && agenda.summary.pending > 0 && (
              <Card className="p-4 border-l-4 border-amber-500">
                <p className="font-medium ui-text-primary">
                  Total pending approval: <span className="text-amber-500">{formatCurrency(agenda.summary.totalPending)}</span> across {agenda.summary.pending} request{agenda.summary.pending !== 1 ? 's' : ''}
                </p>
                <p className="mt-1 text-sm ui-text-secondary">
                  Approve or reject these requests from the Fund Requests page.
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
