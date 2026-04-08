'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { useCurrency } from '@/lib/currency-context'
import { FINANCE_MANAGER_NAV_ITEMS } from '@/lib/admin-nav'

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

interface Teacher {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

interface SalaryRecord {
  id: string
  teacherId: string
  amount: number
  month: number
  year: number
  status: 'PENDING' | 'PAID'
  paidAt: string | null
  notes: string | null
  teacher: Teacher
  recordedByUser: { id: string; firstName: string | null; lastName: string | null }
}

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

export default function TeacherSalariesPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { formatCurrency } = useCurrency()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [salaries, setSalaries] = useState<SalaryRecord[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])

  // Filters
  const [filterMonth, setFilterMonth] = useState<string>(String(new Date().getMonth() + 1))
  const [filterYear, setFilterYear] = useState<string>(String(currentYear))

  // Form
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    teacherId: '',
    amount: '',
    month: String(new Date().getMonth() + 1),
    year: String(currentYear),
    notes: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && session.user.role !== 'FINANCE_MANAGER') redirect('/login')
  }, [session, status])

  const fetchSalaries = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterMonth) params.set('month', filterMonth)
      if (filterYear) params.set('year', filterYear)
      const res = await fetch(`/api/teacher-salaries?${params}`)
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to load salaries', 'error')
        return
      }
      setSalaries(Array.isArray(data.salaries) ? data.salaries : [])
      setTeachers(Array.isArray(data.teachers) ? data.teachers : [])
    } catch {
      showToast('Failed to load salaries', 'error')
    } finally {
      setLoading(false)
    }
  }, [filterMonth, filterYear, showToast])

  useEffect(() => {
    if (session?.user?.role === 'FINANCE_MANAGER') fetchSalaries()
  }, [session, fetchSalaries])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.teacherId || !formData.amount) {
      showToast('Please fill in all required fields', 'warning')
      return
    }
    try {
      setSaving(true)
      const res = await fetch('/api/teacher-salaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: formData.teacherId,
          amount: Number(formData.amount),
          month: Number(formData.month),
          year: Number(formData.year),
          notes: formData.notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to save salary', 'error')
        return
      }
      showToast('Salary record saved', 'success')
      setShowForm(false)
      setFormData({ teacherId: '', amount: '', month: String(new Date().getMonth() + 1), year: String(currentYear), notes: '' })
      await fetchSalaries()
    } catch {
      showToast('Failed to save salary', 'error')
    } finally {
      setSaving(false)
    }
  }

  const markPaid = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID'
    try {
      const res = await fetch(`/api/teacher-salaries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to update status', 'error')
        return
      }
      showToast(newStatus === 'PAID' ? 'Marked as paid' : 'Marked as pending', 'success')
      await fetchSalaries()
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  const deleteSalary = async (id: string) => {
    if (!confirm('Delete this salary record?')) return
    try {
      const res = await fetch(`/api/teacher-salaries/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to delete', 'error')
        return
      }
      showToast('Salary record deleted', 'success')
      await fetchSalaries()
    } catch {
      showToast('Failed to delete', 'error')
    }
  }

  const totalPaid = useMemo(
    () => salaries.filter(s => s.status === 'PAID').reduce((sum, s) => sum + s.amount, 0),
    [salaries]
  )
  const totalPending = useMemo(
    () => salaries.filter(s => s.status === 'PENDING').reduce((sum, s) => sum + s.amount, 0),
    [salaries]
  )

  if (status === 'loading' || !session?.user) return <div>Loading…</div>

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Finance Manager',
        role: 'Finance Manager',
        email: session.user.email,
      }}
      navItems={FINANCE_MANAGER_NAV_ITEMS}
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold ui-text-primary">Teacher Salaries</h1>
            <p className="mt-1 ui-text-secondary">Record and manage monthly salary payments for teachers.</p>
          </div>
          <Button onClick={() => setShowForm(true)}>+ Add Salary</Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide ui-text-secondary">Total This Period</p>
            <p className="mt-1 text-2xl font-bold ui-text-primary">{formatCurrency(totalPaid + totalPending)}</p>
            <p className="text-xs ui-text-secondary">{salaries.length} record{salaries.length !== 1 ? 's' : ''}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">Paid</p>
            <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaid)}</p>
            <p className="text-xs ui-text-secondary">{salaries.filter(s => s.status === 'PAID').length} teachers</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalPending)}</p>
            <p className="text-xs ui-text-secondary">{salaries.filter(s => s.status === 'PENDING').length} teachers</p>
          </Card>
        </div>

        {/* Filters */}
        <Card title="Filter" className="p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Select label="Month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
              <option value="">All months</option>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
            <Select label="Year" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">All years</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>
            <div className="flex items-end">
              <Button onClick={fetchSalaries} className="w-full">Apply</Button>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="px-6 py-12 text-center ui-text-secondary text-sm">Loading…</div>
          ) : salaries.length === 0 ? (
            <div className="px-6 py-12 text-center ui-text-secondary text-sm">No salary records for this period. Click &quot;+ Add Salary&quot; to get started.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b ui-border text-xs ui-text-secondary uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-medium">Teacher</th>
                    <th className="px-4 py-3 text-center font-medium">Period</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Notes</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y ui-border">
                  {salaries.map(sal => {
                    const monthLabel = MONTHS.find(m => m.value === sal.month)?.label ?? sal.month
                    return (
                      <tr key={sal.id} className="hover:ui-bg-hover">
                        <td className="px-4 py-3">
                          <div className="font-medium ui-text-primary">
                            {sal.teacher.firstName} {sal.teacher.lastName}
                          </div>
                          <div className="text-xs ui-text-secondary">{sal.teacher.email}</div>
                        </td>
                        <td className="px-4 py-3 text-center ui-text-secondary">
                          {monthLabel} {sal.year}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold ui-text-primary">
                          {formatCurrency(sal.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            sal.status === 'PAID'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}>
                            {sal.status === 'PAID' ? 'Paid' : 'Pending'}
                          </span>
                          {sal.paidAt && (
                            <div className="mt-0.5 text-xs ui-text-secondary">
                              {new Date(sal.paidAt).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 ui-text-secondary max-w-[180px] truncate" title={sal.notes ?? ''}>
                          {sal.notes || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => markPaid(sal.id, sal.status)}
                              className={`text-xs font-medium hover:underline ${sal.status === 'PAID' ? 'text-amber-500' : 'text-green-500'}`}
                            >
                              {sal.status === 'PAID' ? 'Unmark' : 'Mark Paid'}
                            </button>
                            <button
                              onClick={() => deleteSalary(sal.id)}
                              className="text-xs font-medium text-rose-500 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Add Salary Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
          <Card title="Add Salary Record" className="w-full max-w-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select
                label="Teacher *"
                value={formData.teacherId}
                onChange={e => setFormData(p => ({ ...p, teacherId: e.target.value }))}
                required
              >
                <option value="">— Select teacher —</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName} ({t.email})
                  </option>
                ))}
              </Select>

              <Input
                label="Amount *"
                type="number"
                min="1"
                step="0.01"
                value={formData.amount}
                onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                placeholder="e.g. 5000"
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Month *"
                  value={formData.month}
                  onChange={e => setFormData(p => ({ ...p, month: e.target.value }))}
                  required
                >
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
                <Select
                  label="Year *"
                  value={formData.year}
                  onChange={e => setFormData(p => ({ ...p, year: e.target.value }))}
                  required
                >
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </Select>
              </div>

              <Input
                label="Notes"
                value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes"
              />

              <div className="flex gap-3 justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={saving}>Save</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </DashboardLayout>
  )
}
