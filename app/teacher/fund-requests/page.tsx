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
}

const categoryOptions = [
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'REFRESHMENTS', label: 'Refreshments' },
  { value: 'SPORTS_TRIPS', label: 'Sports & Trips' },
  { value: 'TRAINING_PROGRAMS', label: 'Training Programs' },
  { value: 'KITCHEN', label: 'Kitchen' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'OTHER', label: 'Other' },
]

const statusColors: Record<FundRequestStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export default function TeacherFundRequestsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [requests, setRequests] = useState<FundRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'EQUIPMENT',
    amount: '',
    urgency: 'NORMAL',
  })

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    // Fund requests are no longer available for teachers
    if (session?.user?.role) redirect('/teacher/dashboard')
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
    } catch {
      showToast('Failed to load fund requests', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast, statusFilter])

  useEffect(() => {
    if (session?.user?.role === 'TEACHER') fetchRequests()
  }, [session, fetchRequests])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return requests
    return requests.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q),
    )
  }, [requests, search])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.amount || !formData.category) {
      showToast('Title, category, and amount are required', 'warning')
      return
    }
    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      showToast('Amount must be a positive number', 'warning')
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
        showToast(payload.error || 'Failed to submit request', 'error')
        return
      }
      showToast('Fund request submitted', 'success')
      setFormData({ title: '', description: '', category: 'EQUIPMENT', amount: '', urgency: 'NORMAL' })
      setShowForm(false)
      await fetchRequests()
      setPage(1)
    } catch {
      showToast('Failed to submit request', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleWithdraw = async (id: string) => {
    try {
      const res = await fetch(`/api/fund-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw' }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(payload.error || 'Failed to withdraw request', 'error')
        return
      }
      showToast('Request withdrawn', 'success')
      await fetchRequests()
    } catch {
      showToast('Failed to withdraw request', 'error')
    }
  }

  if (status === 'loading' || !session) return <div>Loading...</div>

  const navItems = [
    { label: 'Dashboard', href: '/teacher/dashboard', icon: '📊' },
    { label: 'My Classes', href: '/teacher/classes', icon: '🏫' },
    { label: 'Students', href: '/teacher/students', icon: '👨‍🎓' },
    { label: 'Assessments', href: '/teacher/assessments', icon: '📋' },
    { label: 'Attendance', href: '/teacher/attendance', icon: '📅' },
    { label: 'Off Days', href: '/teacher/off-days', icon: '🛌' },
    { label: 'Results', href: '/teacher/results', icon: '📝' },
    { label: 'Announcements', href: '/teacher/announcements', icon: '📢' },
    { label: 'Messages', href: '/teacher/messages', icon: '💬' },
  ]

  const columns = [
    { key: 'title', label: 'Title', sortable: true },
    {
      key: 'category',
      label: 'Category',
      renderCell: (r: FundRequest) =>
        categoryOptions.find((c) => c.value === r.category)?.label ?? r.category,
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
      label: 'Review Note',
      renderCell: (r: FundRequest) => r.reviewNote ?? '-',
    },
    {
      key: 'createdAt',
      label: 'Submitted',
      sortable: true,
      renderCell: (r: FundRequest) => new Date(r.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      renderCell: (r: FundRequest) =>
        r.status === 'PENDING' ? (
          <Button variant="danger" size="sm" onClick={() => handleWithdraw(r.id)}>
            Withdraw
          </Button>
        ) : null,
    },
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
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fund Requests</h1>
            <p className="text-gray-600 mt-1">Request funds or purchases. Finance Manager approves smaller amounts; admin reviews larger ones.</p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ New Request'}
          </Button>
        </div>

        {showForm && (
          <Card title="Submit Fund Request">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Title *"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Science lab supplies"
              />
              <TextArea
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional — describe the purpose or specify items"
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
                  options={[
                    { value: 'NORMAL', label: 'Normal' },
                    { value: 'URGENT', label: 'Urgent' },
                  ]}
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

        <Card title="My Requests">
          <div className="flex flex-wrap gap-3 mb-4">
            <Input
              placeholder="Search requests…"
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
            emptyMessage="No fund requests yet"
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
