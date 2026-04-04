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
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [auditLogs, setAuditLogs] = useState<ExpenseAuditLog[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [summary, setSummary] = useState<Summary>({
    totalAmount: 0,
    monthAmount: 0,
    peopleAmount: 0,
    recordedCount: 0,
    approvedCount: 0,
    voidCount: 0,
  })
  const [selectedExpenseId, setSelectedExpenseId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [tablePage, setTablePage] = useState(1)
  const pageSize = 10

  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null)
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

    if (session?.user?.role !== 'FINANCE') {
      redirect('/login')
    }
  }, [session, status])

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/expenses', { cache: 'no-store' })
      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'Failed to load expenses', 'error')
        return
      }

      setExpenses(Array.isArray(data.expenses) ? data.expenses : [])
      setAuditLogs(Array.isArray(data.recentAuditLogs) ? data.recentAuditLogs : [])
      setStudents(Array.isArray(data.students) ? data.students : [])
      setSummary(data.summary || {
        totalAmount: 0,
        monthAmount: 0,
        peopleAmount: 0,
        recordedCount: 0,
        approvedCount: 0,
        voidCount: 0,
      })
      setSelectedExpenseId((current) => current || data.expenses?.[0]?.id || '')
    } catch (error) {
      console.error('Failed to load expenses:', error)
      showToast('Failed to load expenses', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === 'FINANCE') {
      fetchExpenses()
    }
  }, [session?.user?.role])

  const filteredExpenses = useMemo(() => {
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
      showToast('Enter a valid amount', 'warning')
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
        showToast(data.error || 'Failed to save expense', 'error')
        return
      }

      showToast(editingExpense ? 'Expense updated' : 'Expense recorded', 'success')
      setShowModal(false)
      resetForm()
      await fetchExpenses()
    } catch (error) {
      console.error('Failed to save expense:', error)
      showToast('Failed to save expense', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleVoid = async (expenseId: string) => {
    if (!confirm('Void this expense record? The audit trail will be preserved.')) return

    try {
      const res = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to void expense', 'error')
        return
      }

      showToast('Expense voided', 'success')
      await fetchExpenses()
    } catch (error) {
      console.error('Failed to void expense:', error)
      showToast('Failed to void expense', 'error')
    }
  }

  const expenseColumns = useMemo(() => [
    {
      key: 'title',
      label: 'Expense',
      sortable: true,
      renderCell: (expense: ExpenseItem) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-100">{expense.title}</span>
          <span className="text-xs text-slate-400">{formatCategory(expense.category)}{expense.referenceNumber ? ` • ${expense.referenceNumber}` : ''}</span>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      renderCell: (expense: ExpenseItem) => formatCurrency(expense.amount),
    },
    {
      key: 'expenseDate',
      label: 'Date',
      sortable: true,
      renderCell: (expense: ExpenseItem) => new Date(expense.expenseDate).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
    },
    {
      key: 'createdByName',
      label: 'Recorded By',
      sortable: true,
    },
    {
      key: 'auditCount',
      label: 'Audit',
      renderCell: (expense: ExpenseItem) => (
        <button type="button" onClick={() => setSelectedExpenseId(expense.id)} className="text-indigo-300 hover:underline">
          View {expense.auditCount}
        </button>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      renderCell: (expense: ExpenseItem) => (
        <div className="flex gap-2">
          <button type="button" onClick={() => openEditModal(expense)} className="text-indigo-300 hover:underline">
            Edit
          </button>
          {expense.status !== 'VOID' ? (
            <button type="button" onClick={() => handleVoid(expense.id)} className="text-rose-400 hover:underline">
              Void
            </button>
          ) : null}
        </div>
      ),
    },
  ], [selectedExpenseId])

  const navItems = [
    { label: 'Fees', href: '/finance/fees', icon: '💳' },
    { label: 'Expenses', href: '/finance/expenses', icon: '🧾' },
  ]

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
          <Button onClick={openCreateModal} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Expenses" value={formatCurrency(summary.totalAmount)} icon={<Wallet className="h-4 w-4" />} />
          <StatCard title="This Month" value={formatCurrency(summary.monthAmount)} icon={<ReceiptText className="h-4 w-4" />} />
          <StatCard title="People Costs" value={formatCurrency(summary.peopleAmount)} icon={<BadgeDollarSign className="h-4 w-4" />} />
          <StatCard title="Approved Records" value={summary.approvedCount} icon={<ShieldCheck className="h-4 w-4" />} />
        </div>

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
          emptyMessage="No expenses recorded yet."
          rowKey="id"
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
                  <Select label="Status" value={formData.status} onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value as ExpenseStatus }))}>
                    <option value="RECORDED">Recorded</option>
                    <option value="APPROVED">Approved</option>
                    <option value="VOID">Void</option>
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
      </div>
    </DashboardLayout>
  )
}