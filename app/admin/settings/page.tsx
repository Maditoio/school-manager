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
        setThreshold(thresh)
        setThresholdInput(String(thresh))
        if (data.currency) setCurrencyInput(data.currency as CurrencyCode)
        if (data.logoUrl) setLogoUrl(data.logoUrl)
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

          {/* Create Academic Year & Add Term - Combined Form */}
          <Card title={t('Manage Academic Year & Terms')} className="p-5">
            <div className="space-y-5">
              {/* Step 1: Select or Create Academic Year */}
              <div>
                <label className="block text-sm font-semibold ui-text-primary mb-3">{t('Academic Year')}</label>
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-48">
                    <Select
                      label={t('Select or create')}
                      value={selectedAcademicYearId}
                      onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                    >
                      <option value="">{t('Select year')}</option>
                      {academicYears.map((year) => (
                        <option key={year.id} value={year.id}>{year.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={2000}
                      max={2100}
                      value={yearInput}
                      onChange={(e) => setYearInput(e.target.value)}
                      placeholder={t('Year')}
                      className="w-32"
                    />
                    <Button
                      type="button"
                      isLoading={termsSaving}
                      onClick={createAcademicYear}
                      size="md"
                    >
                      {t('Create Year')}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 2: Add Term to Selected Academic Year */}
              {selectedAcademicYearId && (
                <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <label className="block text-sm font-semibold ui-text-primary mb-3">{t('Add Term to this year')}</label>
                  <form className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5" onSubmit={createTerm}>
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
                        className="w-full"
                      >
                        {t('Add Term')}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </Card>

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
          <Card title={t('School Logo')} className="p-5">
            <p className="text-sm ui-text-secondary mb-5">
              {t('Upload your school logo. It appears on generated report cards. PNG or SVG recommended, max 2 MB.')}
            </p>
            <div className="flex items-start gap-6 flex-wrap">
              {/* Preview */}
              <div className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden shrink-0"
                style={{ borderColor: 'var(--border-subtle)' }}>
                {(logoPreview || logoUrl)
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logoPreview || logoUrl} alt="School logo" className="w-full h-full object-cover rounded-lg" />
                  : <span className="text-xs ui-text-secondary text-center px-2">{t('noLogo')}</span>}
              </div>
              <div className="flex-1 min-w-64 space-y-4">
                <div>
                  <label className="block text-sm font-medium ui-text-secondary mb-2">{t('uploadImage')}</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                    onChange={handleLogoFileChange}
                    className="block w-full text-sm ui-text-secondary file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400 cursor-pointer"
                  />
                  {logoFile && (
                    <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{logoFile.name} — {t('readyToUpload')}</p>
                  )}
                </div>
                <div>
                  <Input
                    label={t('pasteImageUrl')}
                    type="url"
                    value={logoPreview ? '' : logoUrl}
                    onChange={e => { setLogoUrl(e.target.value); setLogoFile(null); setLogoPreview('') }}
                    placeholder="https://..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    isLoading={logoSaving}
                    onClick={handleSaveLogo}
                    disabled={!logoFile && !logoUrl}
                  >
                    {t('Save Logo')}
                  </Button>
                  {(logoUrl || logoPreview) && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={logoSaving}
                      onClick={handleClearLogo}
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
