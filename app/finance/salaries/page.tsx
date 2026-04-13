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
import { useLocale } from '@/lib/locale-context'
import { translateText } from '@/lib/client-i18n'
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

interface SalaryConfig {
  teacherId: string
  baseAmount: number
  notes: string | null
}

interface SalaryRecord {
  id: string
  teacherId: string
  amount: number
  paidAmount: number
  month: number
  year: number
  paymentDate: string | null
  status: 'PENDING' | 'PAID'
  paidAt: string | null
  notes: string | null
  teacher: Teacher
  recordedByUser: { id: string; firstName: string | null; lastName: string | null }
}

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

const emptyForm = () => ({
  teacherId: '',
  amount: '',
  paidAmount: '0',
  month: String(new Date().getMonth() + 1),
  year: String(currentYear),
  paymentDate: '',
  notes: '',
})

export default function TeacherSalariesPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { formatCurrency } = useCurrency()
  const { locale } = useLocale()
  const t = useCallback((text: string) => translateText(text, locale), [locale])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const [salaries, setSalaries] = useState<SalaryRecord[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [configs, setConfigs] = useState<SalaryConfig[]>([])

  // Filters
  const [filterMonth, setFilterMonth] = useState<string>(String(new Date().getMonth() + 1))
  const [filterYear, setFilterYear] = useState<string>(String(currentYear))

  // Add / Edit salary modal
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyForm())

  // Base salary config modal
  const [showBaseModal, setShowBaseModal] = useState(false)
  const [baseInputs, setBaseInputs] = useState<Record<string, string>>({})
  const [savingBase, setSavingBase] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && session.user.role !== 'FINANCE_MANAGER') redirect('/login')
  }, [session, status])

  // Load teachers + configs independently on first mount so the modal is always ready
  useEffect(() => {
    if (session?.user?.role !== 'FINANCE_MANAGER') return
    fetch('/api/teacher-salaries?meta=1')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.teachers)) setTeachers(data.teachers)
        if (Array.isArray(data.configs)) setConfigs(data.configs)
      })
      .catch(() => {/* silent – fetchSalaries will also set these */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  const fetchSalaries = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterMonth) params.set('month', filterMonth)
      if (filterYear) params.set('year', filterYear)
      const res = await fetch(`/api/teacher-salaries?${params}`)
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('Failed to load salaries'), 'error')
        return
      }
      setSalaries(Array.isArray(data.salaries) ? data.salaries : [])
      if (Array.isArray(data.teachers) && data.teachers.length > 0) setTeachers(data.teachers)
      if (Array.isArray(data.configs)) setConfigs(data.configs)
    } catch {
      showToast(t('Failed to load salaries'), 'error')
    } finally {
      setLoading(false)
    }
  }, [filterMonth, filterYear, showToast, t])

  useEffect(() => {
    if (session?.user?.role === 'FINANCE_MANAGER') fetchSalaries()
  }, [session, fetchSalaries])

  // ── Form helpers ────────────────────────────────────────────────────────
  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(emptyForm())
  }

  const openEdit = (sal: SalaryRecord) => {
    setFormData({
      teacherId: sal.teacherId,
      amount: String(sal.amount),
      paidAmount: String(sal.paidAmount ?? 0),
      month: String(sal.month),
      year: String(sal.year),
      paymentDate: sal.paymentDate ? sal.paymentDate.split('T')[0] : '',
      notes: sal.notes ?? '',
    })
    setEditingId(sal.id)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId && !formData.teacherId) {
      showToast(t('Please select a teacher'), 'warning')
      return
    }
    if (!formData.amount) {
      showToast(t('Please enter an amount'), 'warning')
      return
    }
    const amount = Number(formData.amount)
    const paidAmount = Number(formData.paidAmount || 0)
    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      showToast(t('Paid amount must be 0 or more'), 'warning')
      return
    }
    if (paidAmount > amount) {
      showToast(t('Paid amount cannot be greater than expected amount'), 'warning')
      return
    }
    try {
      setSaving(true)
      const url = editingId ? `/api/teacher-salaries/${editingId}` : '/api/teacher-salaries'
      const method = editingId ? 'PATCH' : 'POST'
      const body = editingId
        ? { amount, paidAmount, paymentDate: formData.paymentDate || null, notes: formData.notes || null }
        : { teacherId: formData.teacherId, amount, paidAmount, month: Number(formData.month), year: Number(formData.year), paymentDate: formData.paymentDate || null, notes: formData.notes || null }

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('Failed to save salary'), 'error')
        return
      }
      showToast(t('Salary record saved'), 'success')
      closeForm()
      await fetchSalaries()
    } catch {
      showToast(t('Failed to save salary'), 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Mark paid / delete ──────────────────────────────────────────────────
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
        showToast(data.error || t('Failed to update status'), 'error')
        return
      }
      showToast(newStatus === 'PAID' ? t('Marked as paid') : t('Marked as pending'), 'success')
      await fetchSalaries()
    } catch {
      showToast(t('Failed to update status'), 'error')
    }
  }

  const deleteSalary = async (id: string) => {
    if (!confirm(t('Delete this salary record?'))) return
    try {
      const res = await fetch(`/api/teacher-salaries/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || t('Failed to delete'), 'error')
        return
      }
      showToast(t('Salary record deleted'), 'success')
      await fetchSalaries()
    } catch {
      showToast(t('Failed to delete'), 'error')
    }
  }

  // ── Generate from base salaries ─────────────────────────────────────────
  const generateMonth = async () => {
    if (configs.length === 0) {
      showToast(t('Set base salaries for teachers first'), 'warning')
      openBaseModal()
      return
    }
    try {
      setGenerating(true)
      const res = await fetch('/api/teacher-salaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          month: Number(filterMonth || new Date().getMonth() + 1),
          year: Number(filterYear || currentYear),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('Failed to generate'), 'error')
        return
      }
      if (data.generated === 0) {
        showToast(data.message || t('All teachers already have records for this period'), 'info')
      } else {
        showToast(`Generated ${data.generated} salary record${data.generated !== 1 ? 's' : ''}`, 'success')
        await fetchSalaries()
      }
    } catch {
      showToast(t('Failed to generate salaries'), 'error')
    } finally {
      setGenerating(false)
    }
  }

  // ── Base salary config modal ────────────────────────────────────────────
  const openBaseModal = () => {
    const init: Record<string, string> = {}
    teachers.forEach(t => {
      const c = configs.find(c => c.teacherId === t.id)
      init[t.id] = c ? String(c.baseAmount) : ''
    })
    setBaseInputs(init)
    setShowBaseModal(true)
  }

  const saveBase = async (teacherId: string) => {
    const amount = Number(baseInputs[teacherId])
    if (!amount || amount <= 0) {
      showToast(t('Enter a valid monthly amount'), 'warning')
      return
    }
    try {
      setSavingBase(teacherId)
      const res = await fetch('/api/teacher-salaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setBase', teacherId, baseAmount: amount }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('Failed to save'), 'error')
        return
      }
      setConfigs(prev => {
        const next = prev.filter(c => c.teacherId !== teacherId)
        return [...next, { teacherId, baseAmount: amount, notes: null }]
      })
      showToast(t('Base salary saved'), 'success')
    } catch {
      showToast(t('Failed to save'), 'error')
    } finally {
      setSavingBase(null)
    }
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  const totalExpected = useMemo(
    () => salaries.reduce((sum, s) => sum + s.amount, 0),
    [salaries]
  )
  const totalActuallyPaid = useMemo(
    () => salaries.reduce((sum, s) => sum + (s.paidAmount ?? 0), 0),
    [salaries]
  )
  const totalOutstanding = useMemo(
    () => salaries.reduce((sum, s) => sum + Math.max((s.amount ?? 0) - (s.paidAmount ?? 0), 0), 0),
    [salaries]
  )

  const periodLabel = (() => {
    const mo = MONTHS.find(m => m.value === Number(filterMonth))?.label ?? ''
    return filterMonth && filterYear ? `${mo} ${filterYear}` : (filterYear ?? 'All')
  })()

  if (status === 'loading' || !session?.user) return <div>{t('Loading…')}</div>

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
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold ui-text-primary">{t('Teacher Salaries')}</h1>
            <p className="mt-1 ui-text-secondary text-sm">
              {t('Configure base salaries once, then generate records each month in one click.')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={openBaseModal}
              className="rounded-lg border ui-border px-3 py-1.5 text-sm font-medium ui-text-primary hover:ui-bg-hover"
            >
              {t('Base Salaries')}
            </button>
            <button
              onClick={generateMonth}
              disabled={generating}
              className="rounded-lg border ui-border px-3 py-1.5 text-sm font-medium ui-text-primary hover:ui-bg-hover disabled:opacity-50"
            >
              {generating ? t('Generating…') : `${t('Generate')} ${periodLabel}`}
            </button>
            <Button onClick={() => setShowForm(true)}>{t('+ Add Salary')}</Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide ui-text-secondary">{t('Total This Period')}</p>
            <p className="mt-1 text-2xl font-bold ui-text-primary">{formatCurrency(totalExpected)}</p>
            <p className="text-xs ui-text-secondary">{salaries.length} record{salaries.length !== 1 ? 's' : ''}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">{t('Actually Paid')}</p>
            <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalActuallyPaid)}</p>
            <p className="text-xs ui-text-secondary">{t('Includes partial salary payments')}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">{t('Outstanding')}</p>
            <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalOutstanding)}</p>
            <p className="text-xs ui-text-secondary">{t('Remaining unpaid salary balance')}</p>
          </Card>
        </div>

        {/* Compact filter row */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-37.5">
            <Select label={t('Month')} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
              <option value="">{t('All months')}</option>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </div>
          <div className="w-28">
            <Select label={t('Year')} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">{t('All years')}</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
          <Button onClick={fetchSalaries}>{t('Apply')}</Button>
        </div>

        {/* Table */}
        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="px-6 py-12 text-center ui-text-secondary text-sm">{t('Loading…')}</div>
          ) : salaries.length === 0 ? (
            <div className="px-6 py-12 text-center ui-text-secondary text-sm">
              {t('No salary records for this period.')} {' '}
              {configs.length > 0
                ? <button onClick={generateMonth} className="underline text-blue-500">{t('Generate from base salaries')}</button>
                : <button onClick={openBaseModal} className="underline text-blue-500">{t('Configure base salaries to get started')}</button>
              }
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b ui-border text-xs ui-text-secondary uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-medium">{t('Teacher')}</th>
                    <th className="px-4 py-3 text-center font-medium">{t('Period')}</th>
                    <th className="px-4 py-3 text-center font-medium">{t('Pay Date')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('Expected Amount')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('Actual Paid')}</th>
                    <th className="px-4 py-3 text-center font-medium">{t('Status')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('Notes')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y ui-border">
                  {salaries.map((sal, index) => {
                    const monthLabel = MONTHS.find(m => m.value === sal.month)?.label ?? sal.month
                    return (
                      <tr
                        key={sal.id}
                        className="hover:ui-bg-hover"
                        style={{
                          background: index % 2 === 0
                            ? 'color-mix(in srgb, var(--surface-soft) 35%, transparent)'
                            : 'color-mix(in srgb, var(--surface-soft) 65%, transparent)',
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium ui-text-primary">
                            {sal.teacher.firstName} {sal.teacher.lastName}
                          </div>
                          <div className="text-xs ui-text-secondary">{sal.teacher.email}</div>
                        </td>
                        <td className="px-4 py-3 text-center ui-text-secondary">
                          {monthLabel} {sal.year}
                        </td>
                        <td className="px-4 py-3 text-center ui-text-secondary">
                          {sal.paymentDate
                            ? new Date(sal.paymentDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold ui-text-primary">
                          {formatCurrency(sal.amount)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(sal.paidAmount ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(() => {
                            const paidAmount = sal.paidAmount ?? 0
                            const remaining = Math.max(sal.amount - paidAmount, 0)
                            const isPaid = remaining <= 0
                            const isPartial = paidAmount > 0 && remaining > 0
                            const statusClass = isPaid
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : isPartial
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            return (
                              <>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                                  {isPaid ? t('Paid') : isPartial ? t('Partially Paid') : t('Pending')}
                                </span>
                                {remaining > 0 && (
                                  <div className="mt-0.5 text-xs ui-text-secondary">
                                    {t('Remaining:')} {formatCurrency(remaining)}
                                  </div>
                                )}
                              </>
                            )
                          })()}
                          {sal.paidAt && (
                            <div className="mt-0.5 text-xs ui-text-secondary">
                              {t('Fully settled:')} {new Date(sal.paidAt).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 ui-text-secondary max-w-40 truncate" title={sal.notes ?? ''}>
                          {sal.notes || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(sal)}
                              className="text-xs font-medium text-blue-500 hover:underline"
                            >
                              {t('Edit')}
                            </button>
                            <button
                              onClick={() => markPaid(sal.id, sal.status)}
                              className={`text-xs font-medium hover:underline ${sal.status === 'PAID' ? 'text-amber-500' : 'text-green-500'}`}
                            >
                              {sal.status === 'PAID' ? t('Unmark') : t('Mark Paid')}
                            </button>
                            <button
                              onClick={() => deleteSalary(sal.id)}
                              className="text-xs font-medium text-rose-500 hover:underline"
                            >
                              {t('Delete')}
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

      {/* ── Add / Edit Salary Modal ───────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
          <Card title={editingId ? t('Edit Salary Record') : t('Add Salary Record')} className="w-full max-w-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingId && (
                <Select
                  label={t('Teacher *')}
                  value={formData.teacherId}
                  onChange={e => setFormData(p => ({ ...p, teacherId: e.target.value }))}
                  required
                >
                  <option value="">{t('— Select teacher —')}</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} ({t.email})
                    </option>
                  ))}
                </Select>
              )}

              <Input
                label={t('Amount *')}
                type="number"
                min="1"
                step="0.01"
                value={formData.amount}
                onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                placeholder="e.g. 5000"
                required
              />

              <Input
                label={t('Actual Amount Paid')}
                type="number"
                min="0"
                step="0.01"
                value={formData.paidAmount}
                onChange={e => setFormData(p => ({ ...p, paidAmount: e.target.value }))}
                placeholder="0.00"
              />

              {!editingId && (
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label={t('Month *')}
                    value={formData.month}
                    onChange={e => setFormData(p => ({ ...p, month: e.target.value }))}
                    required
                  >
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </Select>
                  <Select
                    label={t('Year *')}
                    value={formData.year}
                    onChange={e => setFormData(p => ({ ...p, year: e.target.value }))}
                    required
                  >
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </Select>
                </div>
              )}

              <Input
                label={t('Payment Date')}
                type="date"
                value={formData.paymentDate}
                onChange={e => setFormData(p => ({ ...p, paymentDate: e.target.value }))}
              />

              <Input
                label={t('Notes')}
                value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder={t('Optional notes')}
              />

              <div className="flex gap-3 justify-end pt-2">
                <Button
                  type="button"
                  onClick={closeForm}
                  className="bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
                  disabled={saving}
                >
                  {t('Cancel')}
                </Button>
                <Button type="submit" isLoading={saving}>{t('Save')}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ── Base Salary Config Modal ──────────────────────────────────────── */}
      {showBaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
          <Card title={t('Base Salaries')} className="w-full max-w-lg p-6">
            <p className="text-sm ui-text-secondary mb-4">
              {t('Set a monthly base salary for each teacher.')}
            </p>
            {teachers.length === 0 ? (
              <p className="text-sm ui-text-secondary py-4 text-center">{t('No teachers found.')}</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {teachers.map(teacher => {
                  const existing = configs.find(c => c.teacherId === teacher.id)
                  return (
                    <div key={teacher.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium ui-text-primary truncate">
                          {teacher.firstName} {teacher.lastName}
                        </p>
                        <p className="text-xs ui-text-secondary truncate">{teacher.email}</p>
                      </div>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={baseInputs[teacher.id] ?? (existing ? String(existing.baseAmount) : '')}
                        onChange={e => setBaseInputs(prev => ({ ...prev, [teacher.id]: e.target.value }))}
                        placeholder={t('Enter monthly amount')}
                        className="w-32 rounded-lg border ui-border bg-(--bg-input) px-3 py-1.5 text-sm ui-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => saveBase(teacher.id)}
                        disabled={savingBase === teacher.id}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingBase === teacher.id ? t('Setting…') : t('Save')}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex justify-end pt-4">
              <Button
                onClick={() => setShowBaseModal(false)}
                className="bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
              >
                {t('Done')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  )
}

