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
import { FINANCE_NAV_ITEMS } from '@/lib/admin-nav'

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
  requestedById: string
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

const categoryOptions = Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))

const statusColors: Record<FundRequestStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export default function FinanceFundRequestsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [requests, setRequests] = useState<FundRequest[]>([])
  const [threshold, setThreshold] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 15

  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'EQUIPMENT',
    amount: '',
    urgency: 'NORMAL',
  })

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejecting, setRejecting] = useState(false)

  // Approve loading state
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Record Expense modal state
  const [recordTarget, setRecordTarget] = useState<FundRequest | null>(null)
  const [recordForm, setRecordForm] = useState({ amount: '', expenseDate: '', referenceNumber: '', notes: '' })
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && !['FINANCE', 'FINANCE_MANAGER'].includes(session.user.role)) redirect('/login')
  }, [session, status])

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/fund-requests?${params}`, { cache: 'no-store' })
      if (!res.ok) {
        showToast('Failed to load fund requests', 'error')
        return
      }
      const data = await res.json()
      setRequests(Array.isArray(data.requests) ? data.requests : [])
      setThreshold(data.expenseApprovalThreshold ?? 0)
    } catch {
      showToast('Failed to load fund requests', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast, statusFilter])

  useEffect(() => {
    if (session?.user?.role && ['FINANCE', 'FINANCE_MANAGER'].includes(session.user.role)) {
      fetchRequests()
    }
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

  const isFinanceManager = session?.user?.role === 'FINANCE_MANAGER'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(formData.amount)
    if (!formData.title.trim() || isNaN(amount) || amount <= 0) {
      showToast('Title and a valid amount are required', 'warning')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/fund-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          category: formData.category,
          amount,
          urgency: formData.urgency,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(payload.error || 'Failed to submit', 'error')
        return
      }
      showToast('Fund request submitted', 'success')
      setFormData({ title: '', description: '', category: 'EQUIPMENT', amount: '', urgency: 'NORMAL' })
      setShowForm(false)
      await fetchRequests()
      setPage(1)
    } catch {
      showToast('Failed to submit', 'error')
    } finally {
      setSubmitting(false)
    }
  }

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
        showToast(payload.error || 'Failed to approve', 'error')
        return
      }
      showToast('Request approved — Finance can now record the expense', 'success')
      await fetchRequests()
    } catch {
      showToast('Failed to approve', 'error')
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    if (!rejectNote.trim()) {
      showToast('A reason is required for rejection', 'warning')
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
        showToast(payload.error || 'Failed to reject', 'error')
        return
      }
      showToast('Request rejected', 'success')
      setRejectTarget(null)
      setRejectNote('')
      await fetchRequests()
    } catch {
      showToast('Failed to reject', 'error')
    } finally {
      setRejecting(false)
    }
  }

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recordTarget) return
    const amount = parseFloat(recordForm.amount)
    if (isNaN(amount) || amount <= 0) {
      showToast('Enter a valid amount', 'warning')
      return
    }
    if (!recordForm.expenseDate) {
      showToast('Invoice date is required', 'warning')
      return
    }
    setRecording(true)
    try {
      const res = await fetch(`/api/fund-requests/${recordTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recordExpense',
          amount,
          expenseDate: recordForm.expenseDate,
          referenceNumber: recordForm.referenceNumber.trim() || undefined,
          notes: recordForm.notes.trim() || undefined,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(payload.error || 'Failed to record expense', 'error')
        return
      }
      showToast('Expense recorded and linked to fund request', 'success')
      setRecordTarget(null)
      setRecordForm({ amount: '', expenseDate: '', referenceNumber: '', notes: '' })
      await fetchRequests()
    } catch {
      showToast('Failed to record expense', 'error')
    } finally {
      setRecording(false)
    }
  }

  if (status === 'loading' || !session) return <div>Loading...</div>

  const navItems = FINANCE_NAV_ITEMS

  const columns = [
    { key: 'requestedByName', label: 'From', sortable: true },
    { key: 'title', label: 'Title', sortable: true },
    {
      key: 'category',
      label: 'Category',
      renderCell: (r: FundRequest) => categoryLabels[r.category] ?? r.category,
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      renderCell: (r: FundRequest) => `$${r.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'urgency',
      label: 'Urgency',
      renderCell: (r: FundRequest) => (
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            r.urgency === 'URGENT' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {r.urgency}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      renderCell: (r: FundRequest) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[r.status]}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: 'reviewNote',
      label: 'Note',
      renderCell: (r: FundRequest) => r.reviewNote ?? '-',
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      renderCell: (r: FundRequest) => new Date(r.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      renderCell: (r: FundRequest) => {
        // FINANCE_MANAGER: approve / reject PENDING requests
        if (isFinanceManager && r.status === 'PENDING') {
          // threshold=0 means no limit configured — FM can approve any amount
          const exceedsLimit = threshold > 0 && r.amount > threshold
          if (exceedsLimit) {
            return <span className="text-xs text-amber-600 font-medium">Requires admin approval</span>
          }
          return (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={approvingId === r.id}
                onClick={() => handleApprove(r.id)}
                className="text-emerald-600 hover:underline text-sm disabled:opacity-50"
              >
                {approvingId === r.id ? '…' : 'Approve'}
              </button>
              <button
                type="button"
                onClick={() => { setRejectTarget(r.id); setRejectNote('') }}
                className="text-red-600 hover:underline text-sm"
              >
                Reject
              </button>
            </div>
          )
        }
        // FINANCE: record expense against approved requests
        if (!isFinanceManager && r.status === 'APPROVED') {
          if (r.expenseId) {
            return <span className="text-xs text-emerald-600 font-medium">✓ Expense recorded</span>
          }
          return (
            <button
              type="button"
              onClick={() => {
                setRecordTarget(r)
                setRecordForm({
                  amount: String(r.amount),
                  expenseDate: new Date().toISOString().slice(0, 10),
                  referenceNumber: '',
                  notes: '',
                })
              }}
              className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Record Expense
            </button>
          )
        }
        return null
      },
    },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Finance',
        role: 'Finance',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fund Requests</h1>
            <p className="text-gray-500 mt-1">Review and manage staff fund requests.</p>
          </div>
          {!isFinanceManager && (
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ New Request'}
          </Button>
          )}
        </div>

        {isFinanceManager && threshold > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Your approval limit is <strong>${threshold.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>. Requests above this require administrator approval.
          </div>
        )}
        {isFinanceManager && threshold === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No approval threshold is set. Contact the administrator to configure your approval limit.
          </div>
        )}

        {showForm && (
          <Card title="Submit Fund Request">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Title *"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Printer paper restock"
              />
              <TextArea
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional details"
                rows={3}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="Category *"
                  value={formData.category}
                  onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                  options={categoryOptions}
                />
                <Input
                  label="Amount *"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                />
                <Select
                  label="Urgency"
                  value={formData.urgency}
                  onChange={(e) => setFormData((p) => ({ ...p, urgency: e.target.value }))}
                  options={[{ value: 'NORMAL', label: 'Normal' }, { value: 'URGENT', label: 'Urgent' }]}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </Button>
                <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Record Expense modal */}
        {recordTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Record Expense</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Approved request: <span className="font-medium text-gray-700">{recordTarget.title}</span>
                  <span className="ml-2 text-gray-400">· {categoryLabels[recordTarget.category] ?? recordTarget.category}</span>
                </p>
              </div>
              <form onSubmit={handleRecordExpense} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Invoice Amount *"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={recordForm.amount}
                    onChange={(e) => setRecordForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder={String(recordTarget.amount)}
                  />
                  <Input
                    label="Invoice Date *"
                    type="date"
                    value={recordForm.expenseDate}
                    onChange={(e) => setRecordForm((p) => ({ ...p, expenseDate: e.target.value }))}
                  />
                </div>
                <Input
                  label="Invoice / Reference Number"
                  value={recordForm.referenceNumber}
                  onChange={(e) => setRecordForm((p) => ({ ...p, referenceNumber: e.target.value }))}
                  placeholder="e.g. INV-2026-0042"
                />
                <TextArea
                  label="Notes"
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional: invoice details, supplier name, etc."
                  rows={2}
                />
                <div className="flex gap-3">
                  <Button type="submit" disabled={recording}>
                    {recording ? 'Recording…' : 'Record Expense'}
                  </Button>
                  <Button variant="secondary" type="button" onClick={() => setRecordTarget(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reject modal */}
        {rejectTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Reject Request</h2>
              <TextArea
                label="Reason *"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Explain why the request is being rejected"
                rows={3}
              />
              <div className="flex gap-3">
                <Button variant="danger" disabled={rejecting} onClick={handleReject}>
                  {rejecting ? 'Rejecting…' : 'Reject'}
                </Button>
                <Button variant="secondary" onClick={() => { setRejectTarget(null); setRejectNote('') }}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <Card title="All Requests">
          <div className="flex flex-wrap gap-3 mb-4">
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="max-w-xs"
            />
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'REJECTED', label: 'Rejected' },
              ]}
            />
          </div>
          <Table
            columns={columns}
            data={paginated}
            loading={loading}
            emptyMessage="No fund requests found"
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
