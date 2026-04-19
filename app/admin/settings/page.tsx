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
  const [minimumPassRatePerSubject, setMinimumPassRatePerSubject] = useState(50)

  // Invoice settings
  const [autoInvoiceEnabled, setAutoInvoiceEnabled] = useState(false)
  const [invoiceDayOfMonth, setInvoiceDayOfMonth] = useState(1)
  const [feesDueDayOfMonth, setFeesDueDayOfMonth] = useState(15)
  const [invoiceActiveMonths, setInvoiceActiveMonths] = useState<number[]>([])
  const [invoiceSettingsSaving, setInvoiceSettingsSaving] = useState(false)
  const [minimumPassRateInput, setMinimumPassRateInput] = useState('50')
  const [minimumPassRateSaving, setMinimumPassRateSaving] = useState(false)

  // Currency setting
  const [currencyInput, setCurrencyInput] = useState<CurrencyCode>('ZAR')
  const [currencySaving, setCurrencySaving] = useState(false)

  // Branding
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [logoSaving, setLogoSaving] = useState(false)

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
        const passRate = data.minimumPassRatePerSubject ?? 50
        setThreshold(thresh)
        setThresholdInput(String(thresh))
        setMinimumPassRatePerSubject(passRate)
        setMinimumPassRateInput(String(passRate))
        if (data.currency) setCurrencyInput(data.currency as CurrencyCode)
        if (data.logoUrl) setLogoUrl(data.logoUrl)
        setAutoInvoiceEnabled(data.autoInvoiceEnabled ?? false)
        setInvoiceDayOfMonth(data.invoiceDayOfMonth ?? 1)
        setFeesDueDayOfMonth(data.feesDueDayOfMonth ?? 15)
        setInvoiceActiveMonths(data.invoiceActiveMonths ?? [])
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

  // ── Branding: save logo ────────────────────────────────────────────────────

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showToast(t('Image must be smaller than 2 MB'), 'warning')
      return
    }
    setLogoFile(file)
    // Show local preview immediately without uploading yet
    const objectUrl = URL.createObjectURL(file)
    setLogoPreview(objectUrl)
  }

  const handleSaveLogo = async () => {
    try {
      setLogoSaving(true)
      let urlToSave = logoUrl

      if (logoFile) {
        // Upload file to Vercel Blob via the dedicated endpoint
        const form = new FormData()
        form.append('file', logoFile)
        const uploadRes = await fetch('/api/schools/logo', { method: 'POST', body: form })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) throw new Error(uploadData.error ?? t('Upload failed'))
        urlToSave = uploadData.url
        // Release the object URL now that upload succeeded
        URL.revokeObjectURL(logoPreview)
        setLogoPreview('')
        setLogoFile(null)
      }

      // Save the blob URL (or typed URL) to school settings
      const res = await fetch('/api/schools/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: urlToSave }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('Failed to save logo'))
      setLogoUrl(data.logoUrl ?? '')
      showToast(t('School logo saved'), 'success')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('Failed to save logo'), 'error')
    } finally {
      setLogoSaving(false)
    }
  }

  const handleClearLogo = async () => {
    try {
      setLogoSaving(true)
      if (logoPreview) { URL.revokeObjectURL(logoPreview); setLogoPreview('') }
      setLogoFile(null)
      // If there's a saved blob URL, delete it from Vercel Blob + settings
      if (logoUrl) {
        const res = await fetch('/api/schools/logo', { method: 'DELETE' })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error ?? t('Failed to clear logo'))
        }
        setLogoUrl('')
      }
      showToast(t('Logo removed'), 'success')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('Failed to clear logo'), 'error')
    } finally {
      setLogoSaving(false)
    }
  }

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

  const handleSaveMinimumPassRate = async () => {
    const value = Number(minimumPassRateInput)
    if (isNaN(value) || value < 0 || value > 100) {
      showToast(t('Please enter a valid percentage between 0 and 100'), 'warning')
      return
    }

    try {
      setMinimumPassRateSaving(true)
      const res = await fetch('/api/schools/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minimumPassRatePerSubject: value }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('Failed to save setting'), 'error')
        return
      }

      setMinimumPassRatePerSubject(data.minimumPassRatePerSubject)
      setMinimumPassRateInput(String(data.minimumPassRatePerSubject))
      showToast(t('Minimum pass rate saved'), 'success')
    } catch {
      showToast(t('Failed to save setting'), 'error')
    } finally {
      setMinimumPassRateSaving(false)
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
    if (isNaN(year) || year < 2000 || year > 2030) {
      showToast(t('Enter a valid year between 2000 and 2030'), 'warning')
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
      setYearInput(String(new Date().getFullYear()))
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
    
    // Check if adding another term would exceed 6 terms
    const selectedYear = academicYears.find(y => y.id === selectedAcademicYearId)
    if (selectedYear && selectedYear.terms.length >= 6) {
      showToast(t('Maximum 6 terms allowed per academic year'), 'warning')
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

  // ── Invoice settings: save ────────────────────────────────────────────────

  const MONTH_NAMES = [
    t('Jan'), t('Feb'), t('Mar'), t('Apr'), t('May'), t('Jun'),
    t('Jul'), t('Aug'), t('Sep'), t('Oct'), t('Nov'), t('Dec'),
  ]

  const handleSaveInvoiceSettings = async () => {
    setInvoiceSettingsSaving(true)
    try {
      const res = await fetch('/api/schools/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoInvoiceEnabled,
          invoiceDayOfMonth,
          feesDueDayOfMonth,
          invoiceActiveMonths,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error || 'Failed to save invoice settings')
      }
      showToast(t('Invoice settings saved'), 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Failed to save invoice settings'), 'error')
    } finally {
      setInvoiceSettingsSaving(false)
    }
  }

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

            {/* Invoice Settings */}
            <Card title={t('Fee Invoice Generation')} className="p-5">
              <p className="text-sm ui-text-secondary mb-4">
                {t('Configure automatic monthly fee invoice generation. Invoices are generated on the chosen day each month, with a configurable due date for students to pay by.')}
              </p>

              <div className="space-y-5">
                {/* Toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    role="switch"
                    aria-checked={autoInvoiceEnabled}
                    onClick={() => setAutoInvoiceEnabled((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoInvoiceEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        autoInvoiceEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </div>
                  <span className="text-sm font-medium ui-text-primary">{t('Auto-generate invoices monthly')}</span>
                </label>

                {/* Day controls */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-md">
                  <div>
                    <label className="block text-xs font-semibold ui-text-secondary mb-1 uppercase tracking-wider">
                      {t('Generation day of month')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={invoiceDayOfMonth}
                      onChange={(e) => setInvoiceDayOfMonth(Number(e.target.value))}
                      className="w-full rounded-md border px-3 py-2 text-sm ui-text-primary ui-surface ui-border focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs ui-text-secondary">{t('Day invoices are auto-created (1–28)')}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold ui-text-secondary mb-1 uppercase tracking-wider">
                      {t('Due day of month')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={feesDueDayOfMonth}
                      onChange={(e) => setFeesDueDayOfMonth(Number(e.target.value))}
                      className="w-full rounded-md border px-3 py-2 text-sm ui-text-primary ui-surface ui-border focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs ui-text-secondary">{t('Day payment is due each month (1–28)')}</p>
                  </div>
                </div>

                {/* Active months */}
                <div>
                  <p className="text-xs font-semibold ui-text-secondary mb-2 uppercase tracking-wider">{t('Active months (leave empty for all)')}</p>
                  <div className="flex flex-wrap gap-2">
                    {MONTH_NAMES.map((name, i) => {
                      const monthNum = i + 1
                      const active = invoiceActiveMonths.includes(monthNum)
                      return (
                        <button
                          key={monthNum}
                          type="button"
                          onClick={() =>
                            setInvoiceActiveMonths((prev) =>
                              active ? prev.filter((m) => m !== monthNum) : [...prev, monthNum]
                            )
                          }
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            active
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'ui-surface ui-text-secondary ui-border hover:border-blue-400'
                          }`}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <Button
                  type="button"
                  isLoading={invoiceSettingsSaving}
                  onClick={handleSaveInvoiceSettings}
                >
                  {t('Save Invoice Settings')}
                </Button>
              </div>
            </Card>
          </div>
        </section>

        {/* ──────────────────────────────────────────────────────── */}
        {/* Academic Calendar                                         */}
        {/* ──────────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider ui-text-secondary">{t('Academic Calendar')}</h2>

          <Card title={t('Academic Pass Mark')} className="mb-4 p-5">
            <p className="text-sm ui-text-secondary mb-4">
              {t('Set the minimum exam percentage required to pass a subject. Dashboard academic KPIs use this value for pass-rate calculations.')}
            </p>
            <div className="flex items-end gap-3 max-w-sm">
              <Input
                label={t('Minimum pass mark (%)')}
                type="number"
                min="0"
                max="100"
                step="1"
                value={minimumPassRateInput}
                onChange={(e) => setMinimumPassRateInput(e.target.value)}
              />
              <Button
                type="button"
                isLoading={minimumPassRateSaving}
                onClick={handleSaveMinimumPassRate}
                className="shrink-0"
              >
                {t('Save')}
              </Button>
            </div>
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
              {t('Current minimum pass mark:')} {minimumPassRatePerSubject}%
            </p>
          </Card>

          {/* Create Academic Year & Add Term - Combined Form */}
          <div className="space-y-4">
            <Card title={t('Create Academic Year')} className="p-4">
              <form className="flex gap-3 items-end flex-wrap" onSubmit={(e) => { e.preventDefault(); createAcademicYear(e); }}>
                <div className="flex-1 min-w-40">
                  <Input
                    label={t('Year')}
                    type="number"
                    min={2000}
                    max={2030}
                    value={yearInput}
                    onChange={(e) => setYearInput(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  isLoading={termsSaving}
                  size="md"
                >
                  {t('Create')}
                </Button>
              </form>
            </Card>

            {selectedAcademicYearId && (
              <Card title={t('Add Term to Academic Year')} className="p-4">
                <form className="grid grid-cols-1 gap-3 md:grid-cols-4 lg:grid-cols-6" onSubmit={createTerm}>
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
                    <Button
                      type="submit"
                      isLoading={termsSaving}
                    >
                      {t('Add')}
                    </Button>
                  </div>
                </form>
                {(academicYears.find(y => y.id === selectedAcademicYearId)?.terms?.length || 0) >= 6 && (
                  <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">{t('Maximum 6 terms reached for this year')}</p>
                )}
              </Card>
            )}
          </div>

            {/* Terms list table */}
            <Card title={t('Academic Terms')} className="p-0 overflow-hidden">
              {termsLoading ? (
                <p className="ui-text-secondary p-5">{t('Loading terms...')}</p>
              ) : allTerms.length === 0 ? (
                <p className="ui-text-secondary p-5">{t('No terms yet. Create an academic year above, then add terms to it.')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--surface-soft)' }}>
                        <th className="px-4 py-3 text-left ui-text-secondary font-semibold">{t('Year')}</th>
                        <th className="px-4 py-3 text-left ui-text-secondary font-semibold">{t('Term')}</th>
                        <th className="px-4 py-3 text-left ui-text-secondary font-semibold">{t('Start')}</th>
                        <th className="px-4 py-3 text-left ui-text-secondary font-semibold">{t('End')}</th>
                        <th className="px-4 py-3 text-left ui-text-secondary font-semibold">{t('Current')}</th>
                        <th className="px-4 py-3 text-left ui-text-secondary font-semibold">{t('Locked')}</th>
                        <th className="px-4 py-3 text-right ui-text-secondary font-semibold">{t('Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTerms.map((term) => (
                        <tr key={term.id} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-4 py-3 ui-text-secondary">{term.academicYearLabel}</td>
                          <td className="px-4 py-3 font-medium ui-text-primary">{term.name}</td>
                          <td className="px-4 py-3 ui-text-secondary">{new Date(term.startDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3 ui-text-secondary">{new Date(term.endDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            {term.isCurrent ? (
                              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t('Current')}</span>
                            ) : (
                              <span className="text-xs ui-text-secondary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {term.isLocked ? (
                              <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-xs ui-text-secondary font-medium">{t('Locked')}</span>
                            ) : (
                              <span className="text-xs ui-text-secondary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
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
        </section>

        {/* ──────────────────────────────────────────────────────── */}
        {/* School Branding                                           */}
        {/* ──────────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider ui-text-secondary">{t('School Branding')}</h2>
          <Card title={t('School Logo')} className="p-4">
            <p className="text-sm ui-text-secondary mb-4">
              {t('Upload your school logo. It appears on generated report cards. PNG or SVG recommended, max 2 MB.')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Preview section */}
              <div>
                <label className="block text-xs font-semibold ui-text-secondary mb-2 uppercase tracking-wider">{t('Preview')}</label>
                <div className="w-full aspect-square rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden bg-surface-soft"
                  style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--surface-soft)' }}>
                  {(logoPreview || logoUrl)
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={logoPreview || logoUrl} alt="School logo" className="w-full h-full object-contain p-2" />
                    : <span className="text-xs ui-text-secondary text-center">{t('noLogo')}</span>}
                </div>
              </div>
              
              {/* Upload section */}
              <div className="md:col-span-2 space-y-3">
                <div>
                  <label className="block text-sm font-medium ui-text-secondary mb-2">{t('uploadImage')}</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                    onChange={handleLogoFileChange}
                    className="block w-full text-xs ui-text-secondary file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50/80 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300 cursor-pointer"
                  />
                  {logoFile && (
                    <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">✓ {logoFile.name}</p>
                  )}
                </div>
                
                <div>
                  <Input
                    label={t('pasteImageUrl')}
                    type="url"
                    value={logoPreview ? '' : logoUrl}
                    onChange={e => { setLogoUrl(e.target.value); setLogoFile(null); setLogoPreview('') }}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    isLoading={logoSaving}
                    onClick={handleSaveLogo}
                    disabled={!logoFile && !logoUrl}
                    size="sm"
                  >
                    {t('Save Logo')}
                  </Button>
                  {(logoUrl || logoPreview) && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={logoSaving}
                      onClick={handleClearLogo}
                      size="sm"
                    >
                      {t('Remove')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  )
}
