'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, TextArea } from '@/components/ui/Form'
import Table from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import { useCurrency } from '@/lib/currency-context'
import { translateText } from '@/lib/client-i18n'
import { useLocale } from '@/lib/locale-context'

type FundRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

type FundRequest = {
  id: string
  title: string
  description: string | null
  category: string
  amount: number
  urgency: string
  status: FundRequestStatus
  reviewNote: string | null
  reviewedAt: string | null
  expenseId: string | null
  createdAt: string
  requestedByName: string
  requestedByRole: string
  reviewedByName: string | null
}

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

const statusColors: Record<FundRequestStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export default function AdminFundRequestsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { formatCurrency } = useCurrency()
  const { locale } = useLocale()
  const t = useCallback((s: string) => translateText(s, locale), [locale])

  const [requests, setRequests] = useState<FundRequest[]>([])
  const [threshold, setThreshold] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [page, setPage] = useState(1)
  const pageSize = 15

  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && session.user.role !== 'SCHOOL_ADMIN') redirect('/login')
  }, [session, status])

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/fund-requests?${params}`, { cache: 'no-store' })
      if (!res.ok) {
        showToast(t('Failed to load fund requests'), 'error')
        return
      }
      const data = await res.json()
      setRequests(Array.isArray(data.requests) ? data.requests : [])
      setThreshold(data.expenseApprovalThreshold ?? 0)
    } catch {
      showToast(t('Failed to load fund requests'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast, statusFilter, t])

  useEffect(() => {
    if (session?.user?.role === 'SCHOOL_ADMIN') fetchRequests()
  }, [session, fetchRequests])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return requests
    return requests.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.requestedByName.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q),
    )
  }, [requests, search])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'PENDING').length, [requests])

  const handleApprove = async (id: string) => {
    setApprovingId(id)
    try {
      const res = await fetch(`/api/fund-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(payload.error || t('Failed to approve'), 'error')
        return
      }
      showToast(t('Request approved'), 'success')
      await fetchRequests()
    } catch {
      showToast(t('Failed to approve'), 'error')
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    if (!rejectNote.trim()) {
      showToast(t('A reason is required for rejection'), 'warning')
      return
    }
    setRejecting(true)
    try {
      const res = await fetch(`/api/fund-requests/${rejectTarget}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reviewNote: rejectNote.trim() }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(payload.error || t('Failed to reject'), 'error')
        return
      }
      showToast(t('Request rejected'), 'success')
      setRejectTarget(null)
      setRejectNote('')
      await fetchRequests()
    } catch {
      showToast(t('Failed to reject'), 'error')
    } finally {
      setRejecting(false)
    }
  }

  if (status === 'loading' || !session) return <div>{t('Loading...')}</div>

  const navItems = ADMIN_NAV_ITEMS

  const columns = [
    { key: 'requestedByName', label: t('From'), sortable: true },
    {
      key: 'requestedByRole',
      label: t('Role'),
      renderCell: (r: FundRequest) => (
        <span className="text-xs text-gray-500 capitalize">{r.requestedByRole.replace('_', ' ').toLowerCase()}</span>
      ),
    },
    { key: 'title', label: t('Title'), sortable: true },
    {
      key: 'category',
      label: t('Category'),
      renderCell: (r: FundRequest) => t(categoryLabels[r.category] ?? r.category),
    },
    {
      key: 'amount',
      label: t('Amount'),
      sortable: true,
      renderCell: (r: FundRequest) => {
        const aboveThreshold = threshold > 0 && r.amount > threshold
        return (
          <span className={aboveThreshold ? 'font-semibold text-amber-700' : ''}>
            {formatCurrency(r.amount)}
            {aboveThreshold && (
              <span className="ml-1 text-xs text-amber-500" title={t('Exceeds FM approval limit')}>↑</span>
            )}
          </span>
        )
      },
    },
    {
      key: 'urgency',
      label: t('Urgency'),
      renderCell: (r: FundRequest) => (
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            r.urgency === 'URGENT' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {r.urgency === 'URGENT' ? t('Urgent') : t('Normal')}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('Status'),
      renderCell: (r: FundRequest) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[r.status]}`}>
          {r.status === 'PENDING' ? t('Pending') : r.status === 'APPROVED' ? t('Approved') : t('Rejected')}
        </span>
      ),
    },
    {
      key: 'reviewNote',
      label: t('Note'),
      renderCell: (r: FundRequest) =>
        r.status !== 'PENDING' && r.reviewNote ? (
          <span title={r.reviewNote} className="cursor-help underline decoration-dotted decoration-gray-400 text-xs">
            {r.reviewNote.length > 30 ? r.reviewNote.slice(0, 30) + '…' : r.reviewNote}
          </span>
        ) : null,
    },
    {
      key: 'createdAt',
      label: t('Date'),
      sortable: true,
      renderCell: (r: FundRequest) => new Date(r.createdAt).toLocaleDateString(),
    },
    {
      key: 'review',
      label: '',
      renderCell: (r: FundRequest) => {
        if (r.status !== 'PENDING') return null
        return (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={approvingId === r.id}
              onClick={() => handleApprove(r.id)}
              className="text-emerald-600 hover:underline text-sm disabled:opacity-50"
            >
              {approvingId === r.id ? '…' : t('Approve')}
            </button>
            <button
              type="button"
              onClick={() => { setRejectTarget(r.id); setRejectNote('') }}
              className="text-red-600 hover:underline text-sm"
            >
              {t('Reject')}
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: t('School Admin'),
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('Fund Requests')}
            {statusFilter === 'PENDING' && pendingCount > 0 && (
              <span className="ml-3 text-sm font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                {pendingCount} {t('Pending').toLowerCase()}
              </span>
            )}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('Review all staff fund requests.')}{' '}
            {t('Requests above the FM threshold (')}
            {threshold > 0 ? formatCurrency(threshold) : t('not set')}
            {t(') require your approval.')}
          </p>
        </div>

        {/* Reject modal */}
        {rejectTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">{t('Reject Request')}</h2>
              <TextArea
                label={t('Reason *')}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder={t('Explain why the request is being rejected')}
                rows={3}
              />
              <div className="flex gap-3">
                <Button variant="danger" disabled={rejecting} onClick={handleReject}>
                  {rejecting ? t('Rejecting…') : t('Reject')}
                </Button>
                <Button variant="secondary" onClick={() => { setRejectTarget(null); setRejectNote('') }}>
                  {t('Cancel')}
                </Button>
              </div>
            </div>
          </div>
        )}

        <Card title={t('Requests')}>
          <div className="flex flex-wrap gap-3 mb-4">
            <Input
              placeholder={t('Search by title or requester…')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="max-w-xs"
            />
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              options={[
                { value: '', label: t('All statuses') },
                { value: 'PENDING', label: t('Pending') },
                { value: 'APPROVED', label: t('Approved') },
                { value: 'REJECTED', label: t('Rejected') },
              ]}
            />
          </div>
          <Table
            columns={columns}
            data={paginated}
            loading={loading}
            emptyMessage={t('No fund requests found')}
            page={page}
            pageSize={pageSize}
            totalCount={filtered.length}
            onPageChange={setPage}
          />
        </Card>
      </div>
    </DashboardLayout>
  )
}
