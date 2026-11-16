'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { CalendarPlus, ChevronDown, ChevronRight, Plus, Save } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { ActionMenu } from '@/components/admin/detail'
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

  // Video courses settings
  const [allowCrossSchoolCourses, setAllowCrossSchoolCourses] = useState(false)
  const [crossSchoolCoursesSaving, setCrossSchoolCoursesSaving] = useState(false)

  // Currency setting
  const [currencyInput, setCurrencyInput] = useState<CurrencyCode>('ZAR')
  const [currencySaving, setCurrencySaving] = useState(false)

  // Branding
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [logoSaving, setLogoSaving] = useState(false)

  // Settings panel tabs — ordered by operational importance
  type SettingsPanelId = 'academic' | 'finance' | 'branding' | 'courses'
  const [activePanel, setActivePanel] = useState<SettingsPanelId>('academic')

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
  const [academicComposer, setAcademicComposer] = useState<'closed' | 'year' | 'term'>('closed')
  const [passMarkEditing, setPassMarkEditing] = useState(false)
  const [expandedYearId, setExpandedYearId] = useState('')

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
        setAllowCrossSchoolCourses(data.allowCrossSchoolCourses ?? false)
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
      const years: AcademicYear[] = Array.isArray(data.academicYears) ? data.academicYears : []
      setAcademicYears(years)
      setSelectedAcademicYearId((prev) => {
        if (prev && years.some((year) => year.id === prev)) return prev
        const current = years.find((year) => year.isCurrent)
        return current?.id || years[0]?.id || ''
      })
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Failed to fetch terms'), 'error')
    } finally {
      setTermsLoading(false)
    }
  }, [showToast, t])

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

  const handleSaveMinimumPassRate = async (): Promise<boolean> => {
    const value = Number(minimumPassRateInput)
    if (isNaN(value) || value < 0 || value > 100) {
      showToast(t('Please enter a valid percentage between 0 and 100'), 'warning')
      return false
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
        return false
      }

      setMinimumPassRatePerSubject(data.minimumPassRatePerSubject)
      setMinimumPassRateInput(String(data.minimumPassRatePerSubject))
      showToast(t('Minimum pass rate saved'), 'success')
      return true
    } catch {
      showToast(t('Failed to save setting'), 'error')
      return false
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

  const selectedAcademicYear = useMemo(
    () => academicYears.find((year) => year.id === selectedAcademicYearId) || null,
    [academicYears, selectedAcademicYearId]
  )

  const selectedYearTerms = useMemo(() => selectedAcademicYear?.terms ?? [], [selectedAcademicYear])

  const currentAcademicYear = useMemo(
    () => academicYears.find((year) => year.isCurrent) || null,
    [academicYears]
  )

  const currentTerm = useMemo(() => {
    for (const year of academicYears) {
      const term = year.terms.find((item) => item.isCurrent)
      if (term) return { year, term }
    }
    return null
  }, [academicYears])

  const openYearComposer = () => {
    setAcademicComposer('year')
    setYearInput(String(new Date().getFullYear() + (academicYears[0] ? 1 : 0)))
  }

  const openTermComposer = (yearId?: string) => {
    const nextYearId = yearId || selectedAcademicYearId || academicYears[0]?.id || ''
    if (nextYearId) {
      setSelectedAcademicYearId(nextYearId)
      setExpandedYearId(nextYearId)
    }
    setAcademicComposer('term')
  }

  const toggleYearExpanded = (yearId: string) => {
    setSelectedAcademicYearId(yearId)
    setExpandedYearId((prev) => (prev === yearId ? '' : yearId))
  }

  // ── Terms: create academic year ────────────────────────────────────────────

  const createAcademicYear = async (event: React.FormEvent) => {
    event.preventDefault()
    const year = Number(yearInput)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
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

      const created: AcademicYear | undefined = data?.academicYear
      if (created?.id) {
        // Show the year immediately even before refetch completes
        setAcademicYears((prev) => {
          const without = prev.filter((item) => item.id !== created.id && item.year !== created.year)
          return [...without, { ...created, terms: Array.isArray(created.terms) ? created.terms : [] }].sort(
            (a, b) => b.year - a.year
          )
        })
        setSelectedAcademicYearId(created.id)
      }

      showToast(t('Academic year saved'), 'success')
      setYearInput(String(Math.min(year + 1, 2100)))
      setAcademicComposer('closed')
      await fetchTerms()
      if (created?.id) {
        setSelectedAcademicYearId(created.id)
        setExpandedYearId(created.id)
        setAcademicComposer('term')
      }
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

    if (endDate < startDate) {
      showToast(t('End date must be on or after start date'), 'warning')
      return
    }

    const selectedYear = academicYears.find((y) => y.id === selectedAcademicYearId)
    if (selectedYear && selectedYear.terms.length >= 6) {
      showToast(t('Maximum 6 terms allowed per academic year'), 'warning')
      return
    }

    if (selectedYear) {
      const startYear = Number(startDate.slice(0, 4))
      const endYear = Number(endDate.slice(0, 4))
      if (
        startYear < selectedYear.year - 1 ||
        endYear > selectedYear.year + 1 ||
        (startYear !== selectedYear.year && endYear !== selectedYear.year)
      ) {
        showToast(
          t('Term dates should fall within the selected academic year') + ` (${selectedYear.year}).`,
          'warning'
        )
        return
      }
    }

    try {
      setTermsSaving(true)
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createTerm',
          academicYearId: selectedAcademicYearId,
          name: termName,
          startDate,
          endDate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('Failed to create term'))
      showToast(t('Term created'), 'success')
      const nextIndex = (selectedYear?.terms.length || 0) + 2
      setTermName(nextIndex <= 6 ? `Term ${nextIndex}` : 'Term 1')
      setStartDate('')
      setEndDate('')
      await fetchTerms()
      // Keep composer open so admins can add Term 2, Term 3, …
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Failed to create term'), 'error')
    } finally {
      setTermsSaving(false)
    }
  }

  // ── Terms: set current year / term ─────────────────────────────────────────

  const setCurrentAcademicYear = async (academicYearId: string) => {
    try {
      setTermsSaving(true)
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setCurrentAcademicYear', academicYearId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('Failed to set current academic year'))
      showToast(t('Current academic year updated'), 'success')
      setSelectedAcademicYearId(academicYearId)
      await fetchTerms()
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Failed to set current academic year'), 'error')
    } finally {
      setTermsSaving(false)
    }
  }

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

  const formatTermDate = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-TZ' : 'en-GB')
  }

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

  const handleSaveCrossSchoolCourses = async (value: boolean) => {
    setCrossSchoolCoursesSaving(true)
    try {
      const res = await fetch('/api/schools/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowCrossSchoolCourses: value }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setAllowCrossSchoolCourses(value)
      showToast(value ? t('Cross-school courses enabled') : t('Cross-school courses disabled'), 'success')
    } catch {
      showToast(t('Failed to save setting'), 'error')
    } finally {
      setCrossSchoolCoursesSaving(false)
    }
  }

  if (status === 'loading' || !session?.user) return <div>{t('Loading...')}</div>

  const settingsPanels: Array<{ id: SettingsPanelId; label: string }> = [
    { id: 'academic', label: t('Academic Calendar') },
    { id: 'finance', label: t('Finance') },
    { id: 'branding', label: t('School Branding') },
    { id: 'courses', label: t('Video Courses') },
  ]

  const toggleClass = (on: boolean) =>
    `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
      on ? 'bg-[#635bff]' : 'bg-[#e0e6ed]'
    }`

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: t('School Admin'),
        email: session.user.email,
      }}
      navItems={ADMIN_NAV_ITEMS}
    >
      <div className="space-y-5">
        <div>
          <h1 className="text-[1.25rem] font-semibold ui-text-primary">{t('Settings')}</h1>
          <p className="mt-1 text-sm ui-text-secondary">
            {t('Manage school-wide configurations — finance rules and academic calendar.')}
          </p>
        </div>

        <div className="overflow-hidden rounded-[10px] border border-[#e0e6ed] bg-white">
          <div
            role="tablist"
            aria-label={t('Settings sections')}
            className="flex gap-1 overflow-x-auto border-b border-[#e0e6ed] bg-[#f6f9fc] px-2 pt-2"
          >
            {settingsPanels.map((panel) => {
              const isActive = activePanel === panel.id
              return (
                <button
                  key={panel.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  id={`settings-tab-${panel.id}`}
                  aria-controls={`settings-panel-${panel.id}`}
                  onClick={() => setActivePanel(panel.id)}
                  className={`shrink-0 rounded-t-[6px] border border-b-0 px-4 py-2.5 text-[0.75rem] font-semibold uppercase tracking-[0.07em] transition-colors ${
                    isActive
                      ? 'border-[#e0e6ed] bg-white text-[#635bff]'
                      : 'border-transparent bg-transparent text-[#8898aa] hover:bg-white/70 hover:text-[#0a2540]'
                  }`}
                >
                  {panel.label}
                </button>
              )
            })}
          </div>

          <div className="space-y-6 p-4 sm:p-5 min-w-0">
            {activePanel === 'academic' && (
            <section
              id="settings-panel-academic"
              role="tabpanel"
              aria-labelledby="settings-tab-academic"
              className="space-y-4"
            >
              <div className="rounded-[10px] border border-[#e0e6ed] bg-white px-4 py-3 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <div>
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-[#8898aa]">
                        {t('Current year')}
                      </p>
                      <p className="mt-0.5 font-semibold ui-text-primary">
                        {currentAcademicYear ? currentAcademicYear.year : t('Not set')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-[#8898aa]">
                        {t('Current term')}
                      </p>
                      <p className="mt-0.5 font-semibold ui-text-primary">
                        {currentTerm
                          ? `${currentTerm.term.name} · ${currentTerm.year.year}`
                          : t('Not set')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-[#8898aa]">
                        {t('Pass mark')}
                      </p>
                      {!passMarkEditing ? (
                        <p className="mt-0.5 font-semibold ui-text-primary">
                          {minimumPassRatePerSubject}%
                          <button
                            type="button"
                            className="ml-2 text-xs font-medium text-[#635bff] hover:text-[#5146e8]"
                            onClick={() => {
                              setMinimumPassRateInput(String(minimumPassRatePerSubject))
                              setPassMarkEditing(true)
                            }}
                          >
                            {t('Edit')}
                          </button>
                        </p>
                      ) : (
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={minimumPassRateInput}
                            onChange={(e) => setMinimumPassRateInput(e.target.value)}
                            className="w-20 rounded-[6px] border border-[#e0e6ed] px-2 py-1 text-sm ui-text-primary focus:outline-none focus:ring-2 focus:ring-[#635bff]/30"
                            aria-label={t('Minimum pass mark (%)')}
                          />
                          <Button
                            size="sm"
                            isLoading={minimumPassRateSaving}
                            onClick={async () => {
                              const saved = await handleSaveMinimumPassRate()
                              if (saved) setPassMarkEditing(false)
                            }}
                          >
                            {t('Save')}
                          </Button>
                          <button
                            type="button"
                            className="text-xs font-medium ui-text-secondary hover:ui-text-primary"
                            onClick={() => setPassMarkEditing(false)}
                          >
                            {t('Cancel')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="max-w-sm text-xs ui-text-secondary">
                    {t('Terms belong to a school year. Set Current activates school-wide use; Lock freezes records for that term.')}
                  </p>
                </div>
              </div>

              <div className="rounded-[10px] border border-[#e0e6ed] bg-white">
                <div className="flex flex-col gap-3 border-b border-[#e0e6ed] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <h3 className="text-[0.875rem] font-semibold ui-text-primary">
                      {t('Academic Years & Terms')}
                    </h3>
                    <p className="mt-0.5 text-xs ui-text-secondary">
                      {t('Browse the calendar below. Use Add to create a year or a term.')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="inline-flex items-center gap-1.5"
                      onClick={openYearComposer}
                    >
                      <CalendarPlus className="h-4 w-4" />
                      {t('Create year')}
                    </Button>
                    <Button
                      size="sm"
                      className="inline-flex items-center gap-1.5"
                      disabled={academicYears.length === 0}
                      onClick={() => openTermComposer()}
                    >
                      <Plus className="h-4 w-4" />
                      {t('Add Term')}
                    </Button>
                  </div>
                </div>

                {academicComposer !== 'closed' && (
                  <div className="border-b border-[#e0e6ed] bg-[#f6f9fc] px-4 py-4 sm:px-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold ui-text-primary">
                        {academicComposer === 'year' ? t('Create academic year') : t('Add term to year')}
                      </p>
                      <button
                        type="button"
                        className="text-xs font-medium ui-text-secondary hover:ui-text-primary"
                        onClick={() => setAcademicComposer('closed')}
                      >
                        {t('Close')}
                      </button>
                    </div>

                    {academicComposer === 'year' ? (
                      <form className="flex flex-wrap items-end gap-3" onSubmit={createAcademicYear}>
                        <div className="min-w-[8rem] max-w-[12rem] flex-1">
                          <Input
                            label={t('Year')}
                            type="number"
                            min={2000}
                            max={2100}
                            value={yearInput}
                            onChange={(e) => setYearInput(e.target.value)}
                          />
                        </div>
                        <Button type="submit" isLoading={termsSaving} className="inline-flex items-center gap-1.5">
                          <CalendarPlus className="h-4 w-4" />
                          {t('Create year')}
                        </Button>
                      </form>
                    ) : academicYears.length === 0 ? (
                      <p className="text-sm ui-text-secondary">
                        {t('Create an academic year before adding terms.')}
                      </p>
                    ) : (
                      <form
                        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
                        onSubmit={createTerm}
                      >
                        <Select
                          label={t('Academic Year')}
                          value={selectedAcademicYearId}
                          onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                          options={academicYears.map((year) => ({
                            value: year.id,
                            label: `${year.year}${year.isCurrent ? ` (${t('Current')})` : ''}`,
                          }))}
                        />
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
                            disabled={!selectedAcademicYearId || selectedYearTerms.length >= 6}
                            className="w-full inline-flex items-center justify-center gap-1.5"
                          >
                            <Plus className="h-4 w-4" />
                            {t('Add Term')}
                          </Button>
                        </div>
                      </form>
                    )}

                    {academicComposer === 'term' && selectedAcademicYear && (
                      <p className="mt-3 text-xs ui-text-secondary">
                        {t('Term dates should fall within')} {selectedAcademicYear.year}
                        {selectedYearTerms.length >= 6
                          ? ` · ${t('Maximum 6 terms reached for this year')}`
                          : ` · ${selectedYearTerms.length}/6 ${t('terms')}`}
                      </p>
                    )}
                  </div>
                )}

                {termsLoading ? (
                  <p className="p-5 text-sm ui-text-secondary">{t('Loading academic years...')}</p>
                ) : academicYears.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm ui-text-secondary">
                      {t('No academic years yet. Create one to get started.')}
                    </p>
                    <Button
                      className="mt-3 inline-flex items-center gap-1.5"
                      onClick={openYearComposer}
                    >
                      <CalendarPlus className="h-4 w-4" />
                      {t('Create year')}
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="ui-table min-w-full text-sm">
                      <thead>
                        <tr>
                          <th>{t('Year / Term')}</th>
                          <th>{t('Dates')}</th>
                          <th>{t('Status')}</th>
                          <th className="text-right">{t('Actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {academicYears.map((year) => {
                          const isExpanded = year.id === expandedYearId
                          const yearMenuItems = [
                            {
                              id: 'add-term',
                              label: t('Add Term'),
                              onClick: () => openTermComposer(year.id),
                              disabled: year.terms.length >= 6 || termsSaving,
                            },
                            ...(!year.isCurrent
                              ? [
                                  {
                                    id: 'set-current-year',
                                    label: t('Set Current'),
                                    onClick: () => {
                                      void setCurrentAcademicYear(year.id)
                                    },
                                    disabled: termsSaving,
                                  },
                                ]
                              : []),
                          ]

                          return (
                            <Fragment key={year.id}>
                              <tr
                                className={isExpanded ? 'bg-[#f0effe]' : 'bg-[#fafbfc]'}
                                style={{ cursor: 'pointer' }}
                                onClick={() => toggleYearExpanded(year.id)}
                                aria-expanded={isExpanded}
                              >
                                <td>
                                  <div className="flex items-center gap-2 font-semibold ui-text-primary">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 shrink-0 text-[#635bff]" aria-hidden />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 shrink-0 text-[#8898aa]" aria-hidden />
                                    )}
                                    <span>
                                      {year.year}
                                      <span className="ml-2 text-[0.6875rem] font-medium uppercase tracking-[0.07em] text-[#8898aa]">
                                        {year.terms.length}/6 {t('terms')}
                                      </span>
                                    </span>
                                  </div>
                                </td>
                                <td className="text-xs ui-text-secondary">{year.name}</td>
                                <td>
                                  {year.isCurrent ? (
                                    <span className="ui-status ui-status-success">{t('Current')}</span>
                                  ) : (
                                    <span className="text-xs ui-text-secondary">—</span>
                                  )}
                                </td>
                                <td>
                                  <div
                                    className="flex justify-end"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ActionMenu label={t('Year actions')} items={yearMenuItems} />
                                  </div>
                                </td>
                              </tr>

                              {isExpanded &&
                                (year.terms.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={4}
                                      className="border-l-[3px] border-l-[#635bff] pl-8 text-xs ui-text-secondary"
                                    >
                                      {t('No terms in this year yet.')}{' '}
                                      <button
                                        type="button"
                                        className="font-medium text-[#635bff] hover:text-[#5146e8]"
                                        onClick={() => openTermComposer(year.id)}
                                      >
                                        {t('Add Term')} →
                                      </button>
                                    </td>
                                  </tr>
                                ) : (
                                  year.terms.map((term) => (
                                    <tr key={term.id}>
                                      <td className="border-l-[3px] border-l-[#635bff] pl-10">
                                        <span className="font-medium ui-text-primary">{term.name}</span>
                                      </td>
                                      <td className="whitespace-nowrap ui-text-secondary">
                                        {formatTermDate(term.startDate)} – {formatTermDate(term.endDate)}
                                      </td>
                                      <td>
                                        <div className="flex flex-wrap gap-1.5">
                                          {term.isCurrent && (
                                            <span className="ui-status ui-status-success">{t('Current')}</span>
                                          )}
                                          {term.isLocked && (
                                            <span className="ui-status ui-status-pending">{t('Locked')}</span>
                                          )}
                                          {!term.isCurrent && !term.isLocked && (
                                            <span className="text-xs ui-text-secondary">—</span>
                                          )}
                                        </div>
                                      </td>
                                      <td>
                                        <div className="flex justify-end">
                                          <ActionMenu
                                            label={t('Term actions')}
                                            items={[
                                              {
                                                id: 'set-current-term',
                                                label: t('Set Current'),
                                                disabled: term.isCurrent || termsSaving,
                                                onClick: () => {
                                                  setSelectedAcademicYearId(year.id)
                                                  void setCurrentTerm(term.id)
                                                },
                                              },
                                              {
                                                id: 'toggle-lock',
                                                label: term.isLocked ? t('Unlock') : t('Lock'),
                                                tone: term.isLocked ? 'default' : 'danger',
                                                disabled: termsSaving,
                                                separatorBefore: true,
                                                onClick: () => {
                                                  setSelectedAcademicYearId(year.id)
                                                  void toggleLock(term)
                                                },
                                              },
                                            ]}
                                          />
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                ))}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
            )}

            {activePanel === 'finance' && (
            <section
              id="settings-panel-finance"
              role="tabpanel"
              aria-labelledby="settings-tab-finance"
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card title={t('School Currency')} className="p-5 h-full">
                  <p className="text-sm ui-text-secondary mb-4">
                    {t('Currency used for fees, expenses, fund requests, and invoices.')}
                  </p>
                  <div className="flex items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <Select
                        label={t('Currency')}
                        value={currencyInput}
                        onChange={(e) => setCurrencyInput(e.target.value as CurrencyCode)}
                        options={CURRENCY_OPTIONS.map((opt) => ({ value: opt.code, label: opt.label }))}
                      />
                    </div>
                    <Button type="button" isLoading={currencySaving} onClick={handleSaveCurrency} className="shrink-0">
                      {t('Save')}
                    </Button>
                  </div>
                </Card>

                <Card title={t('Finance Manager Approval Limit')} className="p-5 h-full">
                  <p className="text-sm ui-text-secondary mb-4">
                    {t('Finance managers can approve up to this amount without admin sign-off. Set 0 to disable.')}
                  </p>
                  <div className="flex items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <Input
                        label={t('Approval limit')}
                        type="number"
                        min="0"
                        step="0.01"
                        value={thresholdInput}
                        onChange={(e) => setThresholdInput(e.target.value)}
                      />
                    </div>
                    <Button type="button" isLoading={thresholdSaving} onClick={handleSaveThreshold} className="shrink-0">
                      {t('Save')}
                    </Button>
                  </div>
                  {threshold > 0 ? (
                    <p className="mt-2 text-xs text-[#1b8a5a]">
                      {t('Current limit:')} {formatCurrency(threshold)}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-[#b07d00]">
                      {t('Delegation disabled — only administrators can approve')}
                    </p>
                  )}
                </Card>

                <Card title={t('Fee Invoice Generation')} className="p-5 xl:col-span-2">
                  <p className="text-sm ui-text-secondary mb-4">
                    {t('Configure automatic monthly fee invoices and due dates.')}
                  </p>

                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.2fr]">
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div
                          role="switch"
                          aria-checked={autoInvoiceEnabled}
                          onClick={() => setAutoInvoiceEnabled((v) => !v)}
                          className={toggleClass(autoInvoiceEnabled)}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                              autoInvoiceEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </div>
                        <span className="text-sm font-medium ui-text-primary">{t('Auto-generate invoices monthly')}</span>
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[0.6875rem] font-semibold ui-text-secondary mb-1 uppercase tracking-[0.07em]">
                            {t('Generation day')}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={28}
                            value={invoiceDayOfMonth}
                            onChange={(e) => setInvoiceDayOfMonth(Number(e.target.value))}
                            className="w-full rounded-[6px] border border-[#e0e6ed] bg-white px-3 py-2 text-sm ui-text-primary focus:outline-none focus:ring-2 focus:ring-[#635bff]/30"
                          />
                          <p className="mt-1 text-xs ui-text-secondary">{t('Day invoices are created (1–28)')}</p>
                        </div>
                        <div>
                          <label className="block text-[0.6875rem] font-semibold ui-text-secondary mb-1 uppercase tracking-[0.07em]">
                            {t('Due day')}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={28}
                            value={feesDueDayOfMonth}
                            onChange={(e) => setFeesDueDayOfMonth(Number(e.target.value))}
                            className="w-full rounded-[6px] border border-[#e0e6ed] bg-white px-3 py-2 text-sm ui-text-primary focus:outline-none focus:ring-2 focus:ring-[#635bff]/30"
                          />
                          <p className="mt-1 text-xs ui-text-secondary">{t('Payment due day (1–28)')}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-[0.6875rem] font-semibold ui-text-secondary mb-2 uppercase tracking-[0.07em]">
                        {t('Active months (leave empty for all)')}
                      </p>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
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
                              className={`rounded-[6px] px-2 py-1.5 text-xs font-medium border transition-colors ${
                                active
                                  ? 'bg-[#635bff] text-white border-[#635bff]'
                                  : 'bg-white text-[#8898aa] border-[#e0e6ed] hover:border-[#635bff] hover:text-[#635bff]'
                              }`}
                            >
                              {name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <Button
                      type="button"
                      isLoading={invoiceSettingsSaving}
                      className="inline-flex items-center gap-1.5"
                      onClick={handleSaveInvoiceSettings}
                    >
                      <Save className="h-4 w-4" />
                      {t('Save Invoice Settings')}
                    </Button>
                  </div>
                </Card>
              </div>
            </section>
            )}

            {activePanel === 'branding' && (
            <section
              id="settings-panel-branding"
              role="tabpanel"
              aria-labelledby="settings-tab-branding"
            >
              <Card title={t('School Logo')} className="p-5">
                <p className="text-sm ui-text-secondary mb-4">
                  {t('Appears on report cards. PNG or SVG recommended, max 2 MB.')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)] gap-5 items-start">
                  <div>
                    <label className="block text-[0.6875rem] font-semibold ui-text-secondary mb-2 uppercase tracking-[0.07em]">
                      {t('Preview')}
                    </label>
                    <div
                      className="w-full aspect-square max-w-[160px] rounded-[10px] border border-dashed flex items-center justify-center overflow-hidden"
                      style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--surface-soft)' }}
                    >
                      {logoPreview || logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoPreview || logoUrl}
                          alt="School logo"
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <span className="text-xs ui-text-secondary text-center px-2">{t('No logo')}</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[0.6875rem] font-semibold ui-text-secondary mb-2 uppercase tracking-[0.07em]">
                        {t('Upload image')}
                      </label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                        onChange={handleLogoFileChange}
                        className="block w-full text-xs ui-text-secondary file:mr-2 file:py-1.5 file:px-3 file:rounded-[6px] file:border-0 file:text-xs file:font-medium file:bg-[#f0effe] file:text-[#635bff] hover:file:bg-[#e8e6ff] cursor-pointer"
                      />
                      {logoFile && (
                        <p className="mt-1 text-xs text-[#1b8a5a]">✓ {logoFile.name}</p>
                      )}
                    </div>

                    <Input
                      label={t('Or paste an image URL')}
                      type="url"
                      value={logoPreview ? '' : logoUrl}
                      onChange={(e) => {
                        setLogoUrl(e.target.value)
                        setLogoFile(null)
                        setLogoPreview('')
                      }}
                      placeholder="https://example.com/logo.png"
                    />

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
            )}

            {activePanel === 'courses' && (
            <section
              id="settings-panel-courses"
              role="tabpanel"
              aria-labelledby="settings-tab-courses"
            >
              <Card title={t('Cross-School Course Sharing')} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <p className="text-sm ui-text-secondary max-w-xl">
                    {t(
                      'When enabled, teachers can share courses with students from other schools on the platform.'
                    )}
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer shrink-0">
                    <div
                      role="switch"
                      aria-checked={allowCrossSchoolCourses}
                      onClick={() =>
                        !crossSchoolCoursesSaving && handleSaveCrossSchoolCourses(!allowCrossSchoolCourses)
                      }
                      className={`${toggleClass(allowCrossSchoolCourses)} ${
                        crossSchoolCoursesSaving ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                          allowCrossSchoolCourses ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </div>
                    <span className="text-sm font-medium ui-text-primary">
                      {allowCrossSchoolCourses ? t('Enabled') : t('Disabled')}
                      {crossSchoolCoursesSaving ? ` · ${t('Saving…')}` : ''}
                    </span>
                  </label>
                </div>
              </Card>
            </section>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
