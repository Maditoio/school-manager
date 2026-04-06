'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import { CURRENCY_OPTIONS, useCurrency } from '@/lib/currency-context'
import type { CurrencyCode } from '@/lib/currency-context'
import { translateText } from '@/lib/client-i18n'
import { useLocale } from '@/lib/locale-context'

// ─── Types ────────────────────────────────────────────────────────────────────

type Term = {
  id: string
  name: string
  academicYearId: string
  startDate: string
  endDate: string
  isCurrent: boolean
  isLocked: boolean
}

type AcademicYear = {
  id: string
  year: number
  name: string
  isCurrent: boolean
  terms: Term[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { currency: activeCurrency, setCurrency: setContextCurrency, formatCurrency } = useCurrency()
  const { locale } = useLocale()
  const t = useCallback((s: string) => translateText(s, locale), [locale])

  // Finance settings
  const [threshold, setThreshold] = useState(0)
  const [thresholdInput, setThresholdInput] = useState('0')
  const [thresholdSaving, setThresholdSaving] = useState(false)

  // Currency setting
  const [currencyInput, setCurrencyInput] = useState<CurrencyCode>('ZAR')
  const [currencySaving, setCurrencySaving] = useState(false)

  // Keep local dropdown in sync with the context value (loaded asynchronously)
  useEffect(() => {
    setCurrencyInput(activeCurrency)
  }, [activeCurrency])

  // Academic terms
  const [termsLoading, setTermsLoading] = useState(true)
  const [termsSaving, setTermsSaving] = useState(false)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [yearInput, setYearInput] = useState(String(new Date().getFullYear()))
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('')
  const [termName, setTermName] = useState('Term 1')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && session.user.role !== 'SCHOOL_ADMIN') redirect('/admin/dashboard')
  }, [session, status])

  // ── Load finance settings ──────────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/schools/settings')
      const data = await res.json()
      if (res.ok) {
        const thresh = data.expenseApprovalThreshold ?? 0
        setThreshold(thresh)
        setThresholdInput(String(thresh))
        if (data.currency) setCurrencyInput(data.currency as CurrencyCode)
      }
    } catch {
      // fail silently — not critical for page load
    }
  }, [])

  // ── Load academic terms ────────────────────────────────────────────────────

  const fetchTerms = useCallback(async () => {
    try {
      setTermsLoading(true)
      const res = await fetch('/api/terms')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error || 'Failed to fetch terms')
      }
      const data = await res.json()
      const years = Array.isArray(data.academicYears) ? data.academicYears : []
      setAcademicYears(years)
      if (!selectedAcademicYearId && years.length > 0) {
        setSelectedAcademicYearId(years[0].id)
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Failed to fetch terms'), 'error')
    } finally {
      setTermsLoading(false)
    }
  }, [selectedAcademicYearId, showToast, t])

  useEffect(() => {
    if (session?.user?.role === 'SCHOOL_ADMIN') {
      fetchSettings()
      fetchTerms()
    }
  }, [session?.user?.role, fetchSettings, fetchTerms])

  // ── Finance: save threshold ────────────────────────────────────────────────

  const handleSaveThreshold = async () => {
    const value = parseFloat(thresholdInput)
    if (isNaN(value) || value < 0) {
      showToast(t('Please enter a valid non-negative amount'), 'warning')
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
        showToast(data.error || t('Failed to save setting'), 'error')
        return
      }
      setThreshold(data.expenseApprovalThreshold)
      setThresholdInput(String(data.expenseApprovalThreshold))
      showToast(t('Approval limit saved'), 'success')
    } catch {
      showToast(t('Failed to save setting'), 'error')
    } finally {
      setThresholdSaving(false)
    }
  }

  // ── Finance: save currency ─────────────────────────────────────────────────

  const handleSaveCurrency = async () => {
    try {
      setCurrencySaving(true)
      const res = await fetch('/api/schools/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: currencyInput }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('Failed to save currency'), 'error')
        return
      }
      setContextCurrency(data.currency as CurrencyCode)
      showToast(t('Currency saved'), 'success')
    } catch {
      showToast(t('Failed to save currency'), 'error')
    } finally {
      setCurrencySaving(false)
    }
  }

  // ── Terms: create academic year ────────────────────────────────────────────

  const createAcademicYear = async (event: React.FormEvent) => {
    event.preventDefault()
    const year = Number(yearInput)
    if (isNaN(year) || year < 2000 || year > 2100) {
      showToast(t('Enter a valid year between 2000 and 2100'), 'warning')
      return
    }
    try {
      setTermsSaving(true)
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createAcademicYear', year, name: `Academic Year ${year}` }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('Failed to create academic year'))
      showToast(t('Academic year saved'), 'success')
      await fetchTerms()
      if (data?.academicYear?.id) setSelectedAcademicYearId(data.academicYear.id)
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Failed to create academic year'), 'error')
    } finally {
      setTermsSaving(false)
    }
  }

  // ── Terms: create term ─────────────────────────────────────────────────────

  const createTerm = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedAcademicYearId || !termName || !startDate || !endDate) {
      showToast(t('Academic year, name, start date and end date are required'), 'warning')
      return
    }
    try {
      setTermsSaving(true)
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createTerm', academicYearId: selectedAcademicYearId, name: termName, startDate, endDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('Failed to create term'))
      showToast(t('Term created'), 'success')
      setTermName('Term 1')
      setStartDate('')
      setEndDate('')
      await fetchTerms()
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Failed to create term'), 'error')
    } finally {
      setTermsSaving(false)
    }
  }

  // ── Terms: set current ─────────────────────────────────────────────────────

  const setCurrentTerm = async (termId: string) => {
    try {
      setTermsSaving(true)
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setCurrentTerm', termId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('Failed to set current term'))
      showToast(t('Current term updated'), 'success')
      await fetchTerms()
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Failed to set current term'), 'error')
    } finally {
      setTermsSaving(false)
    }
  }

  // ── Terms: lock/unlock ─────────────────────────────────────────────────────

  const toggleLock = async (term: Term) => {
    try {
      setTermsSaving(true)
      const res = await fetch(`/api/terms/${term.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: !term.isLocked }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('Failed to update lock status'))
      showToast(term.isLocked ? t('Term unlocked') : t('Term locked'), 'success')
      await fetchTerms()
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Failed to update lock status'), 'error')
    } finally {
      setTermsSaving(false)
    }
  }

  const allTerms = useMemo(
    () =>
      academicYears.flatMap((year) =>
        year.terms.map((term) => ({
          ...term,
          academicYearLabel: year.name,
          academicYear: year.year,
        }))
      ),
    [academicYears]
  )

  if (status === 'loading' || !session?.user) return <div>{t('Loading...')}</div>

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: t('School Admin'),
        email: session.user.email,
      }}
      navItems={ADMIN_NAV_ITEMS}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-[24px] font-bold ui-text-primary">{t('Settings')}</h1>
          <p className="mt-1 ui-text-secondary">
            {t('Manage school-wide configurations — finance rules and academic calendar.')}
          </p>
        </div>

        {/* ──────────────────────────────────────────────────────── */}
        {/* Finance Settings                                          */}
        {/* ──────────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider ui-text-secondary">{t('Finance')}</h2>

          <div className="space-y-4">
            {/* Currency */}
            <Card title={t('School Currency')} className="p-5">
              <p className="text-sm ui-text-secondary mb-4">
                {t('Select the currency used across all financial displays — fees, expenses, fund requests, and invoices.')}
              </p>
              <div className="flex items-end gap-3 max-w-sm">
                <Select
                  label={t('Currency')}
                  value={currencyInput}
                  onChange={(e) => setCurrencyInput(e.target.value as CurrencyCode)}
                  options={CURRENCY_OPTIONS.map((opt) => ({ value: opt.code, label: opt.label }))}
                />
                <Button
                  type="button"
                  isLoading={currencySaving}
                  onClick={handleSaveCurrency}
                  className="shrink-0"
                >
                  {t('Save')}
                </Button>
              </div>
            </Card>

            {/* Approval Threshold */}
            <Card title={t('Finance Manager Approval Limit')} className="p-5">
              <p className="text-sm ui-text-secondary mb-4">
                {t('Finance managers can approve expense requests and expenses up to this amount without requiring administrator sign-off. Set to 0 to disable delegation entirely.')}
              </p>
              <div className="flex items-end gap-3 max-w-sm">
                <Input
                  label={t('Approval limit')}
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
                  {t('Save')}
                </Button>
              </div>
              {threshold > 0 ? (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                  {t('Current limit:')} {formatCurrency(threshold)}
                </p>
              ) : (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {t('Delegation disabled — only administrators can approve expenses and fund requests')}
                </p>
              )}
            </Card>
          </div>
        </section>

        {/* ──────────────────────────────────────────────────────── */}
        {/* Academic Calendar                                         */}
        {/* ──────────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider ui-text-secondary">{t('Academic Calendar')}</h2>

          <div className="space-y-4">
            {/* Create Academic Year */}
            <Card title={t('Create Academic Year')} className="p-5">
              <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={createAcademicYear}>
                <Input
                  label={t('Year')}
                  type="number"
                  min={2000}
                  max={2100}
                  value={yearInput}
                  onChange={(e) => setYearInput(e.target.value)}
                />
                <Button type="submit" isLoading={termsSaving}>{t('Save')}</Button>
              </form>
            </Card>

            {/* Create Term */}
            <Card title={t('Add Term to Academic Year')} className="p-5">
              <form className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5" onSubmit={createTerm}>
                <Select
                  label={t('Academic Year')}
                  value={selectedAcademicYearId}
                  onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                >
                  <option value="">{t('Select year')}</option>
                  {academicYears.map((year) => (
                    <option key={year.id} value={year.id}>{year.name}</option>
                  ))}
                </Select>
                <Input
                  label={t('Term Name')}
                  value={termName}
                  onChange={(e) => setTermName(e.target.value)}
                  placeholder="Term 1"
                />
                <Input
                  label={t('Start Date')}
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  label={t('End Date')}
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <div className="flex items-end">
                  <Button type="submit" isLoading={termsSaving} className="w-full">{t('Add Term')}</Button>
                </div>
              </form>
            </Card>

            {/* Terms list */}
            <Card title={t('Academic Terms')} className="p-5">
              {termsLoading ? (
                <p className="ui-text-secondary">{t('Loading terms...')}</p>
              ) : allTerms.length === 0 ? (
                <p className="ui-text-secondary">{t('No terms yet. Create an academic year above, then add terms to it.')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <th className="px-3 py-2 text-left ui-text-secondary font-medium">{t('Year')}</th>
                        <th className="px-3 py-2 text-left ui-text-secondary font-medium">{t('Term')}</th>
                        <th className="px-3 py-2 text-left ui-text-secondary font-medium">{t('Start')}</th>
                        <th className="px-3 py-2 text-left ui-text-secondary font-medium">{t('End')}</th>
                        <th className="px-3 py-2 text-left ui-text-secondary font-medium">{t('Current')}</th>
                        <th className="px-3 py-2 text-left ui-text-secondary font-medium">{t('Locked')}</th>
                        <th className="px-3 py-2 text-right ui-text-secondary font-medium">{t('Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTerms.map((term) => (
                        <tr key={term.id} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2 ui-text-secondary">{term.academicYearLabel}</td>
                          <td className="px-3 py-2 font-medium ui-text-primary">{term.name}</td>
                          <td className="px-3 py-2 ui-text-secondary">{new Date(term.startDate).toLocaleDateString()}</td>
                          <td className="px-3 py-2 ui-text-secondary">{new Date(term.endDate).toLocaleDateString()}</td>
                          <td className="px-3 py-2">
                            {term.isCurrent ? (
                              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">{t('Current')}</span>
                            ) : (
                              <span className="text-xs ui-text-secondary">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {term.isLocked ? (
                              <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-xs ui-text-secondary">{t('Locked')}</span>
                            ) : (
                              <span className="text-xs ui-text-secondary">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={term.isCurrent || termsSaving}
                                onClick={() => setCurrentTerm(term.id)}
                              >
                                {t('Set Current')}
                              </Button>
                              <Button
                                size="sm"
                                variant={term.isLocked ? 'secondary' : 'danger'}
                                disabled={termsSaving}
                                onClick={() => toggleLock(term)}
                              >
                                {term.isLocked ? t('Unlock') : t('Lock')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}
