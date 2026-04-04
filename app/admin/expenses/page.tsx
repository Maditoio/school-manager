'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import { Input, Select, TextArea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { BadgeDollarSign, ReceiptText, ShieldCheck, Wallet } from 'lucide-react'
import { translateText } from '@/lib/client-i18n'
import { useLocale } from '@/lib/locale-context'

type ExpenseCategory =
  | 'MAINTENANCE' | 'SALARIES' | 'BURSARIES' | 'SPECIAL_DISCOUNTS'
  | 'CLEANING' | 'SOFTWARE_LICENSES' | 'TRAINING_PROGRAMS' | 'SPORTS_TRIPS'
  | 'REFRESHMENTS' | 'KITCHEN' | 'UTILITIES' | 'TRANSPORT' | 'EQUIPMENT' | 'OTHER'

type ExpenseStatus = 'RECORDED' | 'APPROVED' | 'VOID'

type ExpenseItem = {
  id: string
  title: string
  description: string | null
  category: ExpenseCategory
  amount: number
  expenseDate: string
  vendorName: string | null
  referenceNumber: string | null
  beneficiaryName: string | null
  status: ExpenseStatus
  studentName: string | null
  createdById: string
  createdByName: string
  auditCount: number
  updatedAt: string
}

type ExpenseAuditLog = {
  id: string
  expenseId: string
  expenseTitle: string
  action: string
  details: Record<string, unknown> | null
  createdAt: string
  actorName: string
}

type Summary = {
  totalAmount: number
  monthAmount: number
  peopleAmount: number
  recordedCount: number
  approvedCount: number
  voidCount: number
}

const categoryOptions: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'SALARIES', label: 'Salaries' },
  { value: 'BURSARIES', label: 'Bursaries' },
  { value: 'SPECIAL_DISCOUNTS', label: 'Special Discounts' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'SOFTWARE_LICENSES', label: 'Software Licenses' },
  { value: 'TRAINING_PROGRAMS', label: 'Training Programs' },
  { value: 'SPORTS_TRIPS', label: 'Sports Trips' },
  { value: 'REFRESHMENTS', label: 'Refreshments' },
  { value: 'KITCHEN', label: 'Super Kitchen' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'OTHER', label: 'Other' },
]

function formatCurrency(value: number) {
  return `R ${value.toLocaleString('en-ZA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
}

export default function AdminExpensesPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { locale } = useLocale()

  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [auditLogs, setAuditLogs] = useState<ExpenseAuditLog[]>([])
  const [summary, setSummary] = useState<Summary>({
    totalAmount: 0, monthAmount: 0, peopleAmount: 0,
    recordedCount: 0, approvedCount: 0, voidCount: 0,
  })
  const [selectedExpenseId, setSelectedExpenseId] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('RECORDED')
  const [searchQuery, setSearchQuery] = useState('')
  const [tablePage, setTablePage] = useState(1)
  const pageSize = 15
  const auditPageSize = 20
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [incomeSummary, setIncomeSummary] = useState<{ totalIncome: number; totalExpenses: number; net: number } | null>(null)

  // Approve state
  const [approvingSaving, setApprovingSaving] = useState(false)

  // Threshold settings state
  const [threshold, setThreshold] = useState(0)
  const [thresholdInput, setThresholdInput] = useState('0')
  const [thresholdSaving, setThresholdSaving] = useState(false)

  // Void modal state
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [voidTargetId, setVoidTargetId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidSaving, setVoidSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && session.user.role !== 'SCHOOL_ADMIN') redirect('/admin/dashboard')
  }, [session, status])

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (categoryFilter) params.set('category', categoryFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (searchQuery.trim()) params.set('q', searchQuery.trim())
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      params.set('auditPage', String(auditPage))
      params.set('auditPageSize', String(auditPageSize))
      const res = await fetch(`/api/expenses?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || translateText('Failed to load expenses', locale), 'error')
        return
      }
      setExpenses(Array.isArray(data.expenses) ? data.expenses : [])
      setAuditLogs(Array.isArray(data.recentAuditLogs) ? data.recentAuditLogs : [])
      setAuditTotal(data.auditTotal ?? 0)
      setSummary(data.summary || { totalAmount: 0, monthAmount: 0, peopleAmount: 0, recordedCount: 0, approvedCount: 0, voidCount: 0 })
      const t = data.expenseApprovalThreshold ?? 0
      setThreshold(t)
      setThresholdInput(String(t))
      setSelectedExpenseId((cur) => cur || data.expenses?.[0]?.id || '')
    } catch {
      showToast(translateText('Failed to load expenses', locale), 'error')
    } finally {
      setLoading(false)
    }
  }, [locale, categoryFilter, statusFilter, searchQuery, dateFrom, dateTo, auditPage, auditPageSize])

  useEffect(() => {
    if (session?.user?.role === 'SCHOOL_ADMIN') fetchExpenses()
  }, [session?.user?.role, fetchExpenses])

  useEffect(() => {
    if (!session?.user?.role) return
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    fetch(`/api/expenses/summary?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => { if (d.totalIncome !== undefined) setIncomeSummary(d) })
      .catch(() => null)
  }, [session?.user?.role])

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const q = searchQuery.trim().toLowerCase()
      const matchesQ = !q || [e.title, e.vendorName, e.referenceNumber, e.beneficiaryName, e.studentName, e.createdByName]
        .some((v) => String(v || '').toLowerCase().includes(q))
      return matchesQ && (!categoryFilter || e.category === categoryFilter) && (!statusFilter || e.status === statusFilter)
    })
  }, [expenses, searchQuery, categoryFilter, statusFilter])

  const currentPageRows = useMemo(() => {
    const start = (tablePage - 1) * pageSize
    return filteredExpenses.slice(start, start + pageSize)
  }, [filteredExpenses, tablePage])

  const selectedAuditLogs = useMemo(() => auditLogs.filter((l) => l.expenseId === selectedExpenseId), [auditLogs, selectedExpenseId])

  const handleExportCSV = () => {
    const headers = ['Title', 'Category', 'Amount', 'Date', 'Status', 'Vendor', 'Reference', 'Beneficiary', 'Recorded By']
    const rows = filteredExpenses.map((e) => [
      e.title,
      categoryOptions.find((o) => o.value === e.category)?.label || e.category,
      e.amount,
      new Date(e.expenseDate).toLocaleDateString(),
      e.status,
      e.vendorName || '',
      e.referenceNumber || '',
      e.beneficiaryName || '',
      e.createdByName,
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSaveThreshold = async () => {
    const value = parseFloat(thresholdInput)
    if (isNaN(value) || value < 0) {
      showToast(translateText('Please enter a valid amount', locale), 'warning')
      return
    }
    try {
      setThresholdSaving(true)
      const res = await fetch('/api/schools/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseApprovalThreshold: value }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || translateText('Failed to save setting', locale), 'error')
        return
      }
      setThreshold(data.expenseApprovalThreshold)
      setThresholdInput(String(data.expenseApprovalThreshold))
      showToast(translateText('Approval limit saved', locale), 'success')
    } catch {
      showToast(translateText('Failed to save setting', locale), 'error')
    } finally {
      setThresholdSaving(false)
    }
  }

  const handleApprove = async (expenseId: string) => {
    try {
      setApprovingSaving(true)
      const res = await fetch(`/api/expenses/${expenseId}`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || translateText('Failed to approve expense', locale), 'error')
        return
      }
      showToast(translateText('Expense approved', locale), 'success')
      await fetchExpenses()
    } catch {
      showToast(translateText('Failed to approve expense', locale), 'error')
    } finally {
      setApprovingSaving(false)
    }
  }

  const handleVoidClick = (expenseId: string) => {
    setVoidTargetId(expenseId)
    setVoidReason('')
    setShowVoidModal(true)
  }

  const handleVoidConfirm = async () => {
    if (!voidTargetId) return
    const trimmed = voidReason.trim()
    if (trimmed.length < 3) {
      showToast(translateText('Void reason is required (minimum 3 characters)', locale), 'warning')
      return
    }
    try {
      setVoidSaving(true)
      const res = await fetch(`/api/expenses/${voidTargetId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || translateText('Failed to void expense', locale), 'error')
        return
      }
      showToast(translateText('Expense voided', locale), 'success')
      setShowVoidModal(false)
      setVoidTargetId(null)
      await fetchExpenses()
    } catch {
      showToast(translateText('Failed to void expense', locale), 'error')
    } finally {
      setVoidSaving(false)
    }
  }

  const columns = useMemo(() => [
    {
      key: 'title',
      label: translateText('Expense', locale),
      sortable: true,
      renderCell: (e: ExpenseItem) => {
        const catLabel = categoryOptions.find((o) => o.value === e.category)?.label || e.category.replaceAll('_', ' ')
        return (
          <div className="flex flex-col">
            <span className="font-medium ui-text-primary">{e.title}</span>
            <span className="text-xs ui-text-secondary">{translateText(catLabel, locale)}{e.referenceNumber ? ` • ${e.referenceNumber}` : ''}</span>
          </div>
        )
      },
    },
    {
      key: 'amount',
      label: translateText('Amount', locale),
      sortable: true,
      renderCell: (e: ExpenseItem) => formatCurrency(e.amount),
    },
    {
      key: 'expenseDate',
      label: translateText('Date', locale),
      sortable: true,
      renderCell: (e: ExpenseItem) => new Date(e.expenseDate).toLocaleDateString(),
    },
    {
      key: 'createdByName',
      label: translateText('Recorded By', locale),
      sortable: true,
    },
    {
      key: 'status',
      label: translateText('Status', locale),
      sortable: true,
      renderCell: (e: ExpenseItem) => {
        const colors: Record<ExpenseStatus, string> = {
          RECORDED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
          APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
          VOID: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
        }
        const labels: Record<ExpenseStatus, string> = {
          RECORDED: translateText('Recorded', locale),
          APPROVED: translateText('Approved', locale),
          VOID: translateText('Void', locale),
        }
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[e.status]}`}>
            {labels[e.status]}
          </span>
        )
      },
    },
    {
      key: 'auditCount',
      label: translateText('Audit', locale),
      renderCell: (e: ExpenseItem) => (
        <button type="button" onClick={() => setSelectedExpenseId(e.id)} className="text-indigo-400 hover:underline">
          {translateText('View', locale)} {e.auditCount}
        </button>
      ),
    },
    {
      key: 'actions',
      label: translateText('Actions', locale),
      renderCell: (e: ExpenseItem) => {
        if (e.status === 'VOID') return <span className="text-xs ui-text-secondary">—</span>
        return (
          <div className="flex gap-2">
            {e.status === 'RECORDED' ? (
              <button
                type="button"
                disabled={approvingSaving}
                onClick={() => handleApprove(e.id)}
                className="text-emerald-500 hover:underline disabled:opacity-50"
              >
                {translateText('Approve', locale)}
              </button>
            ) : null}
            <button type="button" onClick={() => handleVoidClick(e.id)} className="text-rose-400 hover:underline">
              {translateText('Void', locale)}
            </button>
          </div>
        )
      },
    },
  ], [locale, approvingSaving])

  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { label: 'Students', href: '/admin/students', icon: '👨‍🎓' },
    { label: 'Teachers', href: '/admin/teachers', icon: '👨‍🏫' },
    { label: 'Classes', href: '/admin/classes', icon: '🏫' },
    { label: 'Subjects', href: '/admin/subjects', icon: '📚' },
    { label: 'Attendance', href: '/admin/attendance', icon: '📅' },
    { label: 'Results', href: '/admin/results', icon: '📝' },
    { label: 'Fees', href: '/admin/fees', icon: '💳' },
    { label: 'Expenses', href: '/admin/expenses', icon: '🧾' },
    { label: 'Fund Requests', href: '/admin/fund-requests', icon: '💰' },
    { label: 'Users', href: '/admin/users', icon: '👥' },
    { label: 'Announcements', href: '/admin/announcements', icon: '📢' },
    { label: 'Messages', href: '/admin/messages', icon: '💬' },
  ]

  if (status === 'loading' || !session?.user) return <div>Loading...</div>

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-[24px] font-bold ui-text-primary">
            {translateText('Expense Approval', locale)}
          </h1>
          <p className="mt-1 ui-text-secondary">
            {translateText('Review and approve expenses submitted by the finance team. Approved records are locked from further editing.', locale)}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Expenses" value={formatCurrency(summary.totalAmount)} icon={<Wallet className="h-4 w-4" />} />
          <StatCard title="This Month" value={formatCurrency(summary.monthAmount)} icon={<ReceiptText className="h-4 w-4" />} />
          <StatCard title="Pending Approval" value={summary.recordedCount} icon={<BadgeDollarSign className="h-4 w-4" />} />
          <StatCard title="Approved" value={summary.approvedCount} icon={<ShieldCheck className="h-4 w-4" />} />
        </div>

        {incomeSummary && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}>
              <p className="text-xs font-medium uppercase tracking-wide ui-text-secondary">Fee Income (this month)</p>
              <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(incomeSummary.totalIncome)}</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}>
              <p className="text-xs font-medium uppercase tracking-wide ui-text-secondary">Expenses (this month)</p>
              <p className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(incomeSummary.totalExpenses)}</p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}>
              <p className="text-xs font-medium uppercase tracking-wide ui-text-secondary">Net Position</p>
              <p className={`mt-1 text-xl font-bold ${incomeSummary.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {incomeSummary.net >= 0 ? '+' : ''}{formatCurrency(incomeSummary.net)}
              </p>
            </div>
          </div>
        )}

        <Card title={translateText('Finance Manager Approval Limit', locale)} className="p-4">
          <p className="text-sm ui-text-secondary mb-3">
            {translateText('Finance managers can approve expenses up to this amount. Set to 0 to disable delegation. Expenses above this limit require administrator approval.', locale)}
          </p>
          <div className="flex items-end gap-3 max-w-sm">
            <Input
              label={translateText('Approval limit amount', locale)}
              type="number"
              min="0"
              step="0.01"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
            />
            <Button
              type="button"
              isLoading={thresholdSaving}
              onClick={handleSaveThreshold}
              className="shrink-0"
            >
              {translateText('Save Limit', locale)}
            </Button>
          </div>
          {threshold > 0 ? (
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
              {translateText('Current limit', locale)}: {formatCurrency(threshold)}
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {translateText('Delegation disabled — only administrators can approve expenses', locale)}
            </p>
          )}
        </Card>

        <Card title={translateText('Filters', locale)} className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Select label={translateText('Status', locale)} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setTablePage(1) }}>
              <option value="">{translateText('All statuses', locale)}</option>
              <option value="RECORDED">{translateText('Recorded', locale)}</option>
              <option value="APPROVED">{translateText('Approved', locale)}</option>
              <option value="VOID">{translateText('Void', locale)}</option>
            </Select>
            <Select label={translateText('Category', locale)} value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setTablePage(1) }}>
              <option value="">{translateText('All categories', locale)}</option>
              {categoryOptions.map((o) => <option key={o.value} value={o.value}>{translateText(o.label, locale)}</option>)}
            </Select>
            <Input
              label={translateText('Search', locale)}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setTablePage(1) }}
              placeholder={translateText('Search title, vendor, recorded by...', locale)}
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input label={translateText('From date', locale)} type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setTablePage(1) }} />
            <Input label={translateText('To date', locale)} type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setTablePage(1) }} />
            <div className="flex items-end gap-2">
              <Button onClick={() => { fetchExpenses(); setTablePage(1) }} className="flex-1">
                {translateText('Apply Filters', locale)}
              </Button>
              {(dateFrom || dateTo || categoryFilter || statusFilter || searchQuery) ? (
                <Button variant="secondary" onClick={() => { setDateFrom(''); setDateTo(''); setCategoryFilter(''); setStatusFilter(''); setSearchQuery(''); setTablePage(1) }}>
                  {translateText('Clear', locale)}
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

        <Table
          title={translateText('Expense Register', locale)}
          columns={columns}
          data={currentPageRows}
          loading={loading}
          totalCount={filteredExpenses.length}
          page={tablePage}
          pageSize={pageSize}
          onPageChange={setTablePage}
          emptyMessage={translateText('No expenses found.', locale)}
          rowKey="id"
          onExport={filteredExpenses.length > 0 ? handleExportCSV : undefined}
        />

        <Card title={translateText('Audit Trail', locale)} className="p-4">
          {selectedAuditLogs.length === 0 ? (
            <p className="ui-text-secondary">{translateText('Select an expense to inspect its audit trail.', locale)}</p>
          ) : (
            <div className="space-y-3">
              {selectedAuditLogs.map((log) => (
                <div key={log.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium ui-text-primary">{log.expenseTitle}</p>
                      <p className="text-sm ui-text-secondary">
                        {log.action} {translateText('by', locale)} {log.actorName}
                        {log.details && typeof log.details === 'object' && 'reason' in log.details
                          ? ` — ${log.details.reason}`
                          : null}
                      </p>
                    </div>
                    <span className="text-xs ui-text-secondary">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Paginated full audit log */}
        <Card title={`${translateText('All Audit Events', locale)}${auditTotal > 0 ? ` (${auditTotal})` : ''}`} className="p-4">
          {auditLogs.length === 0 ? (
            <p className="ui-text-secondary">{translateText('No audit events yet.', locale)}</p>
          ) : (
            <>
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: 'var(--surface-soft)' }}>
                    <div className="min-w-0">
                      <span className="font-medium ui-text-primary truncate">{log.expenseTitle}</span>
                      <span className="ml-2 text-xs ui-text-secondary">{log.action} · {log.actorName}</span>
                    </div>
                    <span className="shrink-0 text-xs ui-text-secondary">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              {auditTotal > auditPageSize && (
                <div className="mt-3 flex items-center justify-between text-sm ui-text-secondary">
                  <span>{translateText('Showing', locale)} {(auditPage - 1) * auditPageSize + 1}–{Math.min(auditPage * auditPageSize, auditTotal)} {translateText('of', locale)} {auditTotal}</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={auditPage === 1} onClick={() => setAuditPage((p) => p - 1)}>← {translateText('Prev', locale)}</Button>
                    <Button variant="secondary" size="sm" disabled={auditPage * auditPageSize >= auditTotal} onClick={() => setAuditPage((p) => p + 1)}>{translateText('Next', locale)} →</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Void reason modal */}
      {showVoidModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
          <Card title={translateText('Void Expense', locale)} className="w-full max-w-md p-6">
            <div className="space-y-4">
              <p className="ui-text-secondary text-sm">
                {translateText('Please provide a reason for voiding this expense. This will be permanently recorded in the audit trail.', locale)}
              </p>
              <TextArea
                label={translateText('Reason for voiding', locale)}
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder={translateText('Enter the reason for voiding this expense...', locale)}
              />
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  isLoading={voidSaving}
                  onClick={handleVoidConfirm}
                  className="flex-1 !bg-rose-600 hover:!bg-rose-700"
                >
                  {translateText('Confirm Void', locale)}
                </Button>
                <button
                  type="button"
                  onClick={() => { setShowVoidModal(false); setVoidTargetId(null) }}
                  className="flex-1 ui-button ui-button-secondary"
                  disabled={voidSaving}
                >
                  {translateText('Cancel', locale)}
                </button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </DashboardLayout>
  )
}
