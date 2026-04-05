'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import { Input, Select, TextArea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { BadgeDollarSign, FileText, Plus, ReceiptText, ShieldCheck, Wallet } from 'lucide-react'
import { translateText } from '@/lib/client-i18n'
import { useLocale } from '@/lib/locale-context'
import { FINANCE_NAV_ITEMS } from '@/lib/admin-nav'
type ExpenseCategory =
  | 'MAINTENANCE'
  | 'SALARIES'
  | 'BURSARIES'
  | 'SPECIAL_DISCOUNTS'
  | 'CLEANING'
  | 'SOFTWARE_LICENSES'
  | 'TRAINING_PROGRAMS'
  | 'SPORTS_TRIPS'
  | 'REFRESHMENTS'
  | 'KITCHEN'
  | 'UTILITIES'
  | 'TRANSPORT'
  | 'EQUIPMENT'
  | 'OTHER'

type ExpenseStatus = 'RECORDED' | 'APPROVED' | 'VOID'
type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'M_PESA' | 'ORANGE_MONEY' | 'OTHER'

type ExpenseItem = {
  id: string
  title: string
  description: string | null
  category: ExpenseCategory
  amount: number
  expenseDate: string
  paymentMethod: PaymentMethod | null
  vendorName: string | null
  referenceNumber: string | null
  beneficiaryName: string | null
  status: ExpenseStatus
  studentId: string | null
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

type StudentOption = {
  id: string
  name: string
  admissionNumber: string | null
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

const paymentMethodOptions = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'M_PESA', label: 'M-Pesa' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'OTHER', label: 'Other' },
]

function formatCurrency(value: number) {
  return `R ${value.toLocaleString('en-ZA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
}

function formatCategory(category: ExpenseCategory) {
  return categoryOptions.find((item) => item.value === category)?.label || category.replaceAll('_', ' ')
}

export default function FinanceExpensesPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { locale } = useLocale()
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [auditLogs, setAuditLogs] = useState<ExpenseAuditLog[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPage, setAuditPage] = useState(1)
  const auditPageSize = 20
  const [students, setStudents] = useState<StudentOption[]>([])
  const [summary, setSummary] = useState<Summary>({
    totalAmount: 0,
    monthAmount: 0,
    peopleAmount: 0,
    recordedCount: 0,
    approvedCount: 0,
    voidCount: 0,
  })
  const [incomeSummary, setIncomeSummary] = useState<{ totalIncome: number; totalExpenses: number; net: number } | null>(null)
  const [selectedExpenseId, setSelectedExpenseId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tablePage, setTablePage] = useState(1)
  const pageSize = 10

  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null)
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [voidTargetId, setVoidTargetId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidSaving, setVoidSaving] = useState(false)
  const [approvingSaving, setApprovingSaving] = useState(false)
  const [expenseApprovalThreshold, setExpenseApprovalThreshold] = useState(0)
  const [formData, setFormData] = useState({
    title: '',
    category: 'MAINTENANCE' as ExpenseCategory,
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'BANK_TRANSFER' as PaymentMethod,
    vendorName: '',
    referenceNumber: '',
    beneficiaryName: '',
    studentId: '',
    description: '',
    status: 'RECORDED' as ExpenseStatus,
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }

    if (session?.user?.role && !['FINANCE', 'FINANCE_MANAGER'].includes(session.user.role)) {
      redirect('/login')
    }
  }, [session, status])

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.set('q', searchQuery.trim())
      if (categoryFilter) params.set('category', categoryFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      params.set('auditPage', String(auditPage))
      params.set('auditPageSize', String(auditPageSize))
      const res = await fetch(`/api/expenses?${params}`, { cache: 'no-store' })
      const data = await res.json()

      if (!res.ok) {
        showToast(translateText(data.error || 'Failed to load expenses', locale), 'error')
        return
      }

      setExpenses(Array.isArray(data.expenses) ? data.expenses : [])
      setAuditLogs(Array.isArray(data.recentAuditLogs) ? data.recentAuditLogs : [])
      setAuditTotal(data.auditTotal ?? 0)
      setStudents(Array.isArray(data.students) ? data.students : [])
      setSummary(data.summary || {
        totalAmount: 0,
        monthAmount: 0,
        peopleAmount: 0,
        recordedCount: 0,
        approvedCount: 0,
        voidCount: 0,
      })
      setExpenseApprovalThreshold(data.expenseApprovalThreshold ?? 0)
      setSelectedExpenseId((current) => current || data.expenses?.[0]?.id || '')
    } catch (error) {
      console.error('Failed to load expenses:', error)
      showToast(translateText('Failed to load expenses', locale), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === 'FINANCE' || session?.user?.role === 'FINANCE_MANAGER') {
      fetchExpenses()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.role, auditPage])

  // Fetch income vs expenses summary for current month
  useEffect(() => {
    if (session?.user?.role !== 'FINANCE' && session?.user?.role !== 'FINANCE_MANAGER') return
    const now = new Date()
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
    fetch(`/api/expenses/summary?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => { if (d.totalIncome !== undefined) setIncomeSummary(d) })
      .catch(() => {})
  }, [session?.user?.role])

  const filteredExpenses = useMemo(() => {
    // Client-side search/category/status filter on top of already server-filtered data
    return expenses.filter((expense) => {
      const query = searchQuery.trim().toLowerCase()
      const matchesQuery = !query || [
        expense.title,
        expense.vendorName,
        expense.referenceNumber,
        expense.beneficiaryName,
        expense.studentName,
      ].some((value) => String(value || '').toLowerCase().includes(query))

      const matchesCategory = !categoryFilter || expense.category === categoryFilter
      const matchesStatus = !statusFilter || expense.status === statusFilter

      return matchesQuery && matchesCategory && matchesStatus
    })
  }, [expenses, searchQuery, categoryFilter, statusFilter])

  const currentPageRows = useMemo(() => {
    const start = (tablePage - 1) * pageSize
    return filteredExpenses.slice(start, start + pageSize)
  }, [filteredExpenses, tablePage])

  const selectedAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => log.expenseId === selectedExpenseId)
  }, [auditLogs, selectedExpenseId])

  // CSV export for filtered expenses
  const handleExportCSV = () => {
    const rows = filteredExpenses
    const headers = ['Title', 'Category', 'Amount', 'Date', 'Status', 'Payment Method', 'Vendor', 'Reference', 'Beneficiary', 'Recorded By']
    const lines = rows.map((e) => [
      `"${e.title.replace(/"/g, '""')}"`,
      formatCategory(e.category),
      e.amount.toFixed(2),
      new Date(e.expenseDate).toLocaleDateString(),
      e.status,
      e.paymentMethod ?? '',
      `"${(e.vendorName ?? '').replace(/"/g, '""')}"`,
      e.referenceNumber ?? '',
      `"${(e.beneficiaryName ?? '').replace(/"/g, '""')}"`,
      `"${e.createdByName.replace(/"/g, '""')}"`,
    ].join(','))
    const csv = [headers.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const resetForm = () => {
    setEditingExpense(null)
    setFormData({
      title: '',
      category: 'MAINTENANCE',
      amount: '',
      expenseDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'BANK_TRANSFER',
      vendorName: '',
      referenceNumber: '',
      beneficiaryName: '',
      studentId: '',
      description: '',
      status: 'RECORDED',
    })
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (expense: ExpenseItem) => {
    if (expense.status === 'APPROVED') {
      showToast(translateText('Approved expenses cannot be edited. Void and re-record to make corrections.', locale), 'error')
      return
    }
    setEditingExpense(expense)
    setFormData({
      title: expense.title,
      category: expense.category,
      amount: String(expense.amount),
      expenseDate: expense.expenseDate.slice(0, 10),
      paymentMethod: expense.paymentMethod || 'BANK_TRANSFER',
      vendorName: expense.vendorName || '',
      referenceNumber: expense.referenceNumber || '',
      beneficiaryName: expense.beneficiaryName || '',
      studentId: expense.studentId || '',
      description: expense.description || '',
      status: expense.status,
    })
    setShowModal(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const amount = Number(formData.amount)

    if (!amount || amount <= 0) {
      showToast(translateText('Enter a valid amount', locale), 'warning')
      return
    }

    try {
      setSaving(true)
      const payload = {
        ...formData,
        amount,
        studentId: formData.studentId || undefined,
      }

      const res = await fetch(editingExpense ? `/api/expenses/${editingExpense.id}` : '/api/expenses', {
        method: editingExpense ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        showToast(translateText(data.error || 'Failed to save expense', locale), 'error')
        return
      }

      showToast(translateText(editingExpense ? 'Expense updated' : 'Expense recorded', locale), 'success')
      setShowModal(false)
      resetForm()
      await fetchExpenses()
    } catch (error) {
      console.error('Failed to save expense:', error)
      showToast(translateText('Failed to save expense', locale), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleVoidClick = (expenseId: string) => {
    setVoidTargetId(expenseId)
    setVoidReason('')
    setShowVoidModal(true)
  }

  const handleApprove = async (expenseId: string) => {
    try {
      setApprovingSaving(true)
      const res = await fetch(`/api/expenses/${expenseId}`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) {
        showToast(translateText(data.error || 'Failed to approve expense', locale), 'error')
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
        showToast(translateText(data.error || 'Failed to void expense', locale), 'error')
        return
      }
      showToast(translateText('Expense voided', locale), 'success')
      setShowVoidModal(false)
      setVoidTargetId(null)
      await fetchExpenses()
    } catch (error) {
      console.error('Failed to void expense:', error)
      showToast(translateText('Failed to void expense', locale), 'error')
    } finally {
      setVoidSaving(false)
    }
  }

  const expenseColumns = useMemo(() => [
    {
      key: 'title',
      label: translateText('Expense', locale),
      sortable: true,
      renderCell: (expense: ExpenseItem) => {
        const catLabel = categoryOptions.find((o) => o.value === expense.category)?.label || expense.category.replaceAll('_', ' ')
        return (
          <div className="flex flex-col">
            <span className="font-medium text-slate-100">{expense.title}</span>
            <span className="text-xs text-slate-400">{translateText(catLabel, locale)}{expense.referenceNumber ? ` • ${expense.referenceNumber}` : ''}</span>
          </div>
        )
      },
    },
    {
      key: 'amount',
      label: translateText('Amount', locale),
      sortable: true,
      renderCell: (expense: ExpenseItem) => formatCurrency(expense.amount),
    },
    {
      key: 'expenseDate',
      label: translateText('Date', locale),
      sortable: true,
      renderCell: (expense: ExpenseItem) => new Date(expense.expenseDate).toLocaleDateString(),
    },
    {
      key: 'status',
      label: translateText('Status', locale),
      sortable: true,
      renderCell: (expense: ExpenseItem) => {
        const labels: Record<ExpenseStatus, string> = {
          RECORDED: translateText('Recorded', locale),
          APPROVED: translateText('Approved', locale),
          VOID: translateText('Void', locale),
        }
        return labels[expense.status] || expense.status
      },
    },
    {
      key: 'createdByName',
      label: translateText('Recorded By', locale),
      sortable: true,
    },
    {
      key: 'auditCount',
      label: translateText('Audit', locale),
      renderCell: (expense: ExpenseItem) => (
        <button type="button" onClick={() => setSelectedExpenseId(expense.id)} className="text-indigo-300 hover:underline">
          {translateText('View', locale)} {expense.auditCount}
        </button>
      ),
    },
    {
      key: 'actions',
      label: translateText('Actions', locale),
      renderCell: (expense: ExpenseItem) => {
        if (expense.status === 'APPROVED') {
          return <span className="inline-flex items-center gap-1 text-xs text-emerald-400">🔒 {translateText('Approved', locale)}</span>
        }
        if (expense.status === 'VOID') {
          return <span className="text-xs ui-text-secondary">—</span>
        }
        const isOwn = expense.createdById === session?.user?.id
        const isFinanceManager = session?.user?.role === 'FINANCE_MANAGER'
        const canApprove = isFinanceManager && expenseApprovalThreshold > 0 && expense.amount <= expenseApprovalThreshold
        return (
          <div className="flex gap-2">
            {canApprove ? (
              <button
                type="button"
                disabled={approvingSaving}
                onClick={() => handleApprove(expense.id)}
                className="text-emerald-400 hover:underline disabled:opacity-50"
              >
                {translateText('Approve', locale)}
              </button>
            ) : null}
            {isFinanceManager ? null : (
              <button type="button" onClick={() => openEditModal(expense)} className="text-indigo-300 hover:underline">
                {translateText('Edit', locale)}
              </button>
            )}
            {isOwn ? (
              <button type="button" onClick={() => handleVoidClick(expense.id)} className="text-rose-400 hover:underline">
                {translateText('Void', locale)}
              </button>
            ) : null}
          </div>
        )
      },
    },
  ], [selectedExpenseId, locale, session?.user?.id, session?.user?.role, expenseApprovalThreshold, approvingSaving])

  const navItems = FINANCE_NAV_ITEMS

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Finance',
        role: 'Finance',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold ui-text-primary">Expenses</h1>
            <p className="mt-1 ui-text-secondary">Track operational costs, salaries, student support, maintenance, and every school expense with a full audit trail.</p>
          </div>
          {session?.user?.role !== 'FINANCE_MANAGER' && (
          <Button onClick={openCreateModal} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Expenses" value={formatCurrency(summary.totalAmount)} icon={<Wallet className="h-4 w-4" />} />
          <StatCard title="This Month" value={formatCurrency(summary.monthAmount)} icon={<ReceiptText className="h-4 w-4" />} />
          <StatCard title="People Costs" value={formatCurrency(summary.peopleAmount)} icon={<BadgeDollarSign className="h-4 w-4" />} />
          <StatCard title="Approved Records" value={summary.approvedCount} icon={<ShieldCheck className="h-4 w-4" />} />
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

        {session?.user?.role === 'FINANCE_MANAGER' ? (
          <div className={`rounded-xl border px-4 py-3 text-sm ${expenseApprovalThreshold > 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
            {expenseApprovalThreshold > 0
              ? `${translateText('Your approval limit', locale)}: ${formatCurrency(expenseApprovalThreshold)}. ${translateText('Expenses at or below this amount can be approved by you; larger expenses require administrator approval.', locale)}`
              : translateText('No approval limit has been configured by your administrator. You cannot approve expenses at this time.', locale)}
          </div>
        ) : null}

        <Card title="Expense Filters" className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Select label="Category" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setTablePage(1) }}>
              <option value="">All categories</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
            <Select label="Status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setTablePage(1) }}>
              <option value="">All statuses</option>
              <option value="RECORDED">Recorded</option>
              <option value="APPROVED">Approved</option>
              <option value="VOID">Void</option>
            </Select>
            <Input label="Search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setTablePage(1) }} placeholder="Search title, vendor, beneficiary..." />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input label="From date" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setTablePage(1) }} />
            <Input label="To date" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setTablePage(1) }} />
            <div className="flex items-end gap-2">
              <Button
                onClick={() => { fetchExpenses(); setTablePage(1) }}
                className="flex-1"
              >
                Apply Filters
              </Button>
              {(dateFrom || dateTo || categoryFilter || statusFilter || searchQuery) ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                    setCategoryFilter('')
                    setStatusFilter('')
                    setSearchQuery('')
                    setTablePage(1)
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

        <Table
          title="Expense Register"
          columns={expenseColumns}
          data={currentPageRows}
          loading={loading}
          totalCount={filteredExpenses.length}
          page={tablePage}
          pageSize={pageSize}
          onPageChange={setTablePage}
          emptyMessage={translateText('No expenses recorded yet.', locale)}
          rowKey="id"
          onExport={filteredExpenses.length > 0 ? handleExportCSV : undefined}
        />

        <Card title="Audit Trail" className="p-4">
          {selectedAuditLogs.length === 0 ? (
            <p className="ui-text-secondary">Select an expense to inspect its audit trail.</p>
          ) : (
            <div className="space-y-3">
              {selectedAuditLogs.map((log) => (
                <div key={log.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium ui-text-primary">{log.expenseTitle}</p>
                      <p className="text-sm ui-text-secondary">{log.action} by {log.actorName}</p>
                    </div>
                    <span className="text-xs ui-text-secondary">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Full paginated audit log */}
        <Card title={`All Audit Events${auditTotal > 0 ? ` (${auditTotal})` : ''}`} className="p-4">
          {auditLogs.length === 0 ? (
            <p className="ui-text-secondary">No audit events yet.</p>
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
                  <span>Showing {(auditPage - 1) * auditPageSize + 1}–{Math.min(auditPage * auditPageSize, auditTotal)} of {auditTotal}</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={auditPage === 1} onClick={() => setAuditPage((p) => p - 1)}>← Prev</Button>
                    <Button variant="secondary" size="sm" disabled={auditPage * auditPageSize >= auditTotal} onClick={() => setAuditPage((p) => p + 1)}>Next →</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {showModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
            <Card title={editingExpense ? 'Edit Expense' : 'Add Expense'} className="w-full max-w-2xl p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input label="Title" value={formData.title} onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))} required />
                  <Select label="Category" value={formData.category} onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value as ExpenseCategory }))}>
                    {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                  <Input label="Amount" type="number" min="0" step="0.01" value={formData.amount} onChange={(event) => setFormData((prev) => ({ ...prev, amount: event.target.value }))} required />
                  <Input label="Expense Date" type="date" value={formData.expenseDate} onChange={(event) => setFormData((prev) => ({ ...prev, expenseDate: event.target.value }))} required />
                  <Select label="Payment Method" value={formData.paymentMethod} onChange={(event) => setFormData((prev) => ({ ...prev, paymentMethod: event.target.value as PaymentMethod }))}>
                    {paymentMethodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                  <Input label="Vendor / Payee" value={formData.vendorName} onChange={(event) => setFormData((prev) => ({ ...prev, vendorName: event.target.value }))} />
                  <Input label="Reference Number" value={formData.referenceNumber} onChange={(event) => setFormData((prev) => ({ ...prev, referenceNumber: event.target.value }))} />
                  <Input label="Beneficiary" value={formData.beneficiaryName} onChange={(event) => setFormData((prev) => ({ ...prev, beneficiaryName: event.target.value }))} />
                  <Select label="Related Student" value={formData.studentId} onChange={(event) => setFormData((prev) => ({ ...prev, studentId: event.target.value }))}>
                    <option value="">No student linked</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>{student.name}{student.admissionNumber ? ` (${student.admissionNumber})` : ''}</option>
                    ))}
                  </Select>
                </div>
                <TextArea label="Description / Notes" rows={4} value={formData.description} onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))} />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" isLoading={saving} className="flex-1">{editingExpense ? 'Update Expense' : 'Save Expense'}</Button>
                  <button type="button" onClick={() => { setShowModal(false); resetForm() }} className="flex-1 ui-button ui-button-secondary">Cancel</button>
                </div>
              </form>
            </Card>
          </div>
        ) : null}

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
      </div>
    </DashboardLayout>
  )
}