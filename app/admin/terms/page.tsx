'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { CalendarPlus, Plus } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DetailCard } from '@/components/admin/detail'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import Table from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import { useAdminUi } from '@/lib/use-admin-ui'

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

type TermRow = Term & {
  academicYearLabel: string
  academicYear: number
}

export default function TermsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { locale, tAdmin, tCommon } = useAdminUi()

  const [loading, setLoading] = useState(true)
  const [yearSaving, setYearSaving] = useState(false)
  const [termSaving, setTermSaving] = useState(false)
  const [rowSaving, setRowSaving] = useState(false)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])

  const [yearInput, setYearInput] = useState(String(new Date().getFullYear()))
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('')
  const defaultTermName = tAdmin('term1Placeholder', 'Trimestre 1')
  const [termName, setTermName] = useState(defaultTermName)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const dateLocale = locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-TZ' : 'en-GB'
  const busy = yearSaving || termSaving || rowSaving

  useEffect(() => {
    setTermName(defaultTermName)
  }, [defaultTermName])

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN' && session?.user?.role !== 'DEPUTY_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  const fetchTerms = useCallback(async () => {
    try {
      const res = await fetch('/api/terms')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error || tAdmin('failedLoadTerms', 'Échec du chargement des trimestres'))
      }

      const data = await res.json()
      const years = Array.isArray(data.academicYears) ? data.academicYears : []
      setAcademicYears(years)

      setSelectedAcademicYearId((prev) => {
        if (prev && years.some((year: AcademicYear) => year.id === prev)) return prev
        return years[0]?.id || ''
      })
    } catch (error) {
      console.error('Failed to fetch terms:', error)
      showToast(
        error instanceof Error ? error.message : tAdmin('failedLoadTerms', 'Échec du chargement des trimestres'),
        'error'
      )
    } finally {
      setLoading(false)
    }
  }, [showToast, tAdmin])

  useEffect(() => {
    if (session?.user?.role === 'SCHOOL_ADMIN' || session?.user?.role === 'DEPUTY_ADMIN') {
      fetchTerms()
    }
  }, [fetchTerms, session])

  const selectedYear = useMemo(
    () => academicYears.find((year) => year.id === selectedAcademicYearId) || null,
    [academicYears, selectedAcademicYearId]
  )
  const selectedYearTermCount = selectedYear?.terms.length || 0
  const atTermLimit = selectedYearTermCount >= 6

  const createAcademicYear = async (event: React.FormEvent) => {
    event.preventDefault()
    const year = Number(yearInput)
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      showToast(tAdmin('enterValidYear', 'Entrez une année valide entre 2000 et 2100'), 'error')
      return
    }

    setYearSaving(true)
    try {
      const yearName =
        locale === 'fr'
          ? `Année scolaire ${year}`
          : locale === 'sw'
            ? `Mwaka wa masomo ${year}`
            : `Academic Year ${year}`

      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createAcademicYear',
          year,
          name: yearName,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || tAdmin('failedSaveAcademicYear', "Échec de l'enregistrement de l'année scolaire"))
      }

      showToast(tAdmin('academicYearSaved', 'Année scolaire enregistrée'), 'success')
      await fetchTerms()
      if (data?.academicYear?.id) {
        setSelectedAcademicYearId(data.academicYear.id)
      }
    } catch (error) {
      console.error('Failed to create academic year:', error)
      showToast(
        error instanceof Error
          ? error.message
          : tAdmin('failedSaveAcademicYear', "Échec de l'enregistrement de l'année scolaire"),
        'error'
      )
    } finally {
      setYearSaving(false)
    }
  }

  const createTerm = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedAcademicYearId) {
      showToast(tAdmin('selectAcademicYearRequired', 'Veuillez sélectionner une année scolaire'), 'error')
      return
    }
    if (atTermLimit) {
      showToast(tAdmin('maxSixTerms', 'Maximum 6 trimestres autorisés par année scolaire'), 'warning')
      return
    }
    if (!termName.trim()) {
      showToast(tAdmin('termNameRequired', 'Le nom du trimestre est requis'), 'error')
      return
    }
    if (!startDate || !endDate) {
      showToast(tAdmin('startEndRequired', 'Les dates de début et de fin sont requises'), 'error')
      return
    }

    setTermSaving(true)
    try {
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createTerm',
          academicYearId: selectedAcademicYearId,
          name: termName.trim(),
          startDate,
          endDate,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || tAdmin('failedCreateTerm', 'Échec de la création du trimestre'))
      }

      showToast(tAdmin('termCreated', 'Trimestre créé'), 'success')
      setStartDate('')
      setEndDate('')
      setTermName(defaultTermName)
      await fetchTerms()
    } catch (error) {
      console.error('Failed to create term:', error)
      showToast(
        error instanceof Error ? error.message : tAdmin('failedCreateTerm', 'Échec de la création du trimestre'),
        'error'
      )
    } finally {
      setTermSaving(false)
    }
  }

  const setCurrentTerm = async (termId: string) => {
    setRowSaving(true)
    try {
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setCurrentTerm', termId }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || tAdmin('failedUpdateTerm', 'Échec de la mise à jour du trimestre'))
      }
      showToast(tAdmin('currentTermUpdated', 'Trimestre en cours mis à jour'), 'success')
      await fetchTerms()
    } catch (error) {
      console.error('Failed to set current term:', error)
      showToast(
        error instanceof Error ? error.message : tAdmin('failedUpdateTerm', 'Échec de la mise à jour du trimestre'),
        'error'
      )
    } finally {
      setRowSaving(false)
    }
  }

  const toggleLock = async (term: Term) => {
    setRowSaving(true)
    try {
      const res = await fetch(`/api/terms/${term.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: !term.isLocked }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || tAdmin('failedUpdateTerm', 'Échec de la mise à jour du trimestre'))
      }
      showToast(
        term.isLocked
          ? tAdmin('termUnlocked', 'Trimestre déverrouillé')
          : tAdmin('termLocked', 'Trimestre verrouillé'),
        'success'
      )
      await fetchTerms()
    } catch (error) {
      console.error('Failed to update term lock:', error)
      showToast(
        error instanceof Error ? error.message : tAdmin('failedUpdateTerm', 'Échec de la mise à jour du trimestre'),
        'error'
      )
    } finally {
      setRowSaving(false)
    }
  }

  const allTerms = useMemo<TermRow[]>(
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

  const filteredTerms = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return allTerms.filter((term) => {
      if (yearFilter && String(term.academicYear) !== yearFilter) return false
      if (!query) return true
      return (
        term.name.toLowerCase().includes(query) ||
        term.academicYearLabel.toLowerCase().includes(query) ||
        String(term.academicYear).includes(query)
      )
    })
  }, [allTerms, searchTerm, yearFilter])

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredTerms.slice(start, start + pageSize)
  }, [filteredTerms, currentPage])

  const yearOptions = useMemo(
    () =>
      academicYears
        .slice()
        .sort((a, b) => b.year - a.year)
        .map((year) => ({
          value: String(year.year),
          label: year.name,
        })),
    [academicYears]
  )

  const formatDate = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString(dateLocale)
  }

  const columns = [
    {
      key: 'academicYearLabel',
      label: tAdmin('academicYear', 'Année scolaire'),
      renderCell: (row: TermRow) => <span className="ui-text-secondary">{row.academicYearLabel}</span>,
    },
    {
      key: 'name',
      label: tAdmin('term', 'Trimestre'),
      renderCell: (row: TermRow) => <span className="font-semibold ui-text-primary">{row.name}</span>,
    },
    {
      key: 'startDate',
      label: tAdmin('start', 'Début'),
      renderCell: (row: TermRow) => <span className="ui-text-secondary">{formatDate(row.startDate)}</span>,
    },
    {
      key: 'endDate',
      label: tAdmin('end', 'Fin'),
      renderCell: (row: TermRow) => <span className="ui-text-secondary">{formatDate(row.endDate)}</span>,
    },
    {
      key: 'isCurrent',
      label: tAdmin('current', 'En cours'),
      renderCell: (row: TermRow) =>
        row.isCurrent ? (
          <span className="ui-status ui-status-success">{tAdmin('current', 'En cours')}</span>
        ) : (
          <span className="text-xs ui-text-secondary">—</span>
        ),
    },
    {
      key: 'isLocked',
      label: tAdmin('locked', 'Verrouillé'),
      renderCell: (row: TermRow) =>
        row.isLocked ? (
          <span className="ui-status ui-status-pending">{tAdmin('locked', 'Verrouillé')}</span>
        ) : (
          <span className="text-xs ui-text-secondary">—</span>
        ),
    },
  ]

  const getRowActions = (term: TermRow) => [
    ...(!term.isCurrent
      ? [
          {
            label: tAdmin('setCurrent', 'Définir comme en cours'),
            onClick: () => {
              if (!busy) void setCurrentTerm(term.id)
            },
          },
        ]
      : []),
    {
      label: term.isLocked ? tAdmin('unlock', 'Déverrouiller') : tAdmin('lock', 'Verrouiller'),
      danger: !term.isLocked,
      onClick: () => {
        if (!busy) void toggleLock(term)
      },
    },
  ]

  if (status === 'loading' || !session) {
    return <div>{tCommon('loading', 'Chargement...')}</div>
  }

  const navItems = session?.user?.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session?.user?.role === 'DEPUTY_ADMIN' ? 'Deputy Admin' : 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-[20px] font-semibold ui-text-primary">
            {tAdmin('academicTerms', 'Trimestres scolaires')}
          </h1>
          <p className="mt-1 text-sm ui-text-secondary">
            {tAdmin(
              'academicTermsHelp',
              'Créez des années scolaires, ajoutez des trimestres, définissez le trimestre en cours et verrouillez les trimestres finalisés.'
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <DetailCard>
            <h2 className="text-sm font-semibold ui-text-primary">
              {tAdmin('createAcademicYear', 'Créer une année scolaire')}
            </h2>
            <p className="mt-1 text-sm ui-text-secondary">
              {tAdmin('startNewSchoolYearHint', 'Démarrez une nouvelle année scolaire, puis ajoutez des trimestres.')}
            </p>
            <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={createAcademicYear}>
              <div className="min-w-0 flex-1">
                <Input
                  label={tAdmin('yearLabel', 'Année')}
                  type="number"
                  min={2000}
                  max={2100}
                  value={yearInput}
                  onChange={(event) => setYearInput(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                isLoading={yearSaving}
                disabled={busy}
                className="shrink-0 inline-flex items-center gap-1.5"
              >
                <CalendarPlus className="h-4 w-4" />
                {tAdmin('saveAcademicYear', "Enregistrer l'année scolaire")}
              </Button>
            </form>
          </DetailCard>

          <DetailCard>
            <h2 className="text-sm font-semibold ui-text-primary">
              {tAdmin('createTerm', 'Créer un trimestre')}
            </h2>
            <p className="mt-1 text-sm ui-text-secondary">
              {tAdmin('addTermHint', 'Ajoutez un trimestre à une année scolaire existante.')}
            </p>
            <form
              className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
              onSubmit={createTerm}
            >
              <Select
                label={tAdmin('academicYear', 'Année scolaire')}
                value={selectedAcademicYearId}
                onChange={(event) => setSelectedAcademicYearId(event.target.value)}
              >
                <option value="">{tAdmin('selectYear', "Sélectionner l'année")}</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </Select>

              <Input
                label={tAdmin('termName', 'Nom du trimestre')}
                value={termName}
                onChange={(event) => setTermName(event.target.value)}
                placeholder={defaultTermName}
              />

              <Input
                label={tAdmin('startDate', 'Date de début')}
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />

              <Input
                label={tAdmin('endDate', 'Date de fin')}
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />

              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  isLoading={termSaving}
                  disabled={busy || !selectedAcademicYearId || atTermLimit}
                  className="inline-flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  {tAdmin('createTerm', 'Créer un trimestre')}
                </Button>
                {atTermLimit ? (
                  <p className="text-xs text-[#b07d00]">
                    {tAdmin('maxSixTermsReached', 'Maximum 6 trimestres atteints pour cette année')}
                  </p>
                ) : null}
              </div>
            </form>
          </DetailCard>
        </div>

        <Table
          title={tAdmin('terms', 'Trimestres')}
          columns={columns}
          data={pageRows}
          loading={loading}
          totalCount={filteredTerms.length}
          page={currentPage}
          pageSize={pageSize}
          onSearch={(value) => {
            setSearchTerm(value)
            setCurrentPage(1)
          }}
          onPageChange={setCurrentPage}
          filterLabel={tAdmin('academicYear', 'Année scolaire')}
          filterOptions={[
            { value: '', label: tAdmin('allYears', 'Toutes les années') },
            ...yearOptions,
          ]}
          activeFilter={yearFilter}
          onFilterChange={(value) => {
            setYearFilter(value)
            setCurrentPage(1)
          }}
          getRowActions={getRowActions}
          rowKey="id"
          emptyMessage={
            searchTerm.trim() || yearFilter
              ? tAdmin('noTermsSearchResults', 'Aucun trimestre ne correspond à votre recherche.')
              : tAdmin(
                  'noTermsFound',
                  'Aucun trimestre trouvé. Créez une année scolaire et des trimestres pour commencer.'
                )
          }
          ariaLabel={tAdmin('terms', 'Trimestres')}
        />
      </div>
    </DashboardLayout>
  )
}
