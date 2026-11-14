'use client'

import { useState, useEffect, useMemo, useCallback, startTransition } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import Table from '@/components/ui/Table'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { useConfirmDialog } from '@/lib/useConfirmDialog'
import { BookOpen, ChevronDown, ChevronRight, Plus, School, Search, Zap } from 'lucide-react'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import { getSubjectPresets } from '@/lib/subject-presets'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject {
  id: string
  name: string
  code: string | null
  passRate: number | null
}

interface ClassItem {
  id: string
  name: string
  grade: string | null
  academicYear: number
  subjectAssignments: Array<{
    subject: Subject
    teacher: { id: string; firstName: string | null; lastName: string | null }
  }>
}

interface PresetSubject {
  name: string
  code: string
  selected: boolean
  customCode: string
}

function toPresetState(list: Array<{ name: string; code: string }>): PresetSubject[] {
  return list.map((p) => ({ ...p, selected: false, customCode: p.code }))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubjectsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { confirm } = useConfirmDialog()

  // Data
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null)

  // UI state
  const [activeTab, setActiveTab] = useState<'byClass' | 'catalog'>('byClass')
  const [expandedClassIds, setExpandedClassIds] = useState<Set<string>>(new Set())
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogPage, setCatalogPage] = useState(1)
  const catalogPageSize = 10

  // Manual add/edit modal
  const [showModal, setShowModal] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [formData, setFormData] = useState({ name: '', code: '', passRate: '' })

  // Quick-add presets modal
  const [showPresetsModal, setShowPresetsModal] = useState(false)
  const [presetTab, setPresetTab] = useState<'primary' | 'secondary'>('primary')
  const [presetLocale, setPresetLocale] = useState<'fr' | 'en'>('fr')
  const [primaryPresets, setPrimaryPresets] = useState<PresetSubject[]>([])
  const [secondaryPresets, setSecondaryPresets] = useState<PresetSubject[]>([])
  const [presetSearch, setPresetSearch] = useState('')
  const [batchLoading, setBatchLoading] = useState(false)

  // ─── Translations ────────────────────────────────────────────────────────

  const preferredLanguage = session?.user?.preferredLanguage || 'en'
  const languageMessages = useMemo(() => {
    return preferredLanguage === 'fr' ? frMessages : preferredLanguage === 'sw' ? swMessages : enMessages
  }, [preferredLanguage])

  const adminUi = useMemo(
    () => ((languageMessages as Record<string, unknown>).adminUi || {}) as Record<string, string>,
    [languageMessages]
  )
  const common = useMemo(
    () => ((languageMessages as Record<string, unknown>).common || {}) as Record<string, string>,
    [languageMessages]
  )

  const tAdmin = useCallback((key: string, fallback: string) => adminUi[key] || fallback, [adminUi])
  const tCommon = useCallback((key: string, fallback: string) => common[key] || fallback, [common])

  // ─── Auth guard ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session && session.user.role !== 'SCHOOL_ADMIN' && session.user.role !== 'DEPUTY_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  // French UI → French curriculum presets; otherwise English pack
  useEffect(() => {
    setPresetLocale(preferredLanguage === 'fr' ? 'fr' : 'en')
  }, [preferredLanguage])

  useEffect(() => {
    const packs = getSubjectPresets(presetLocale)
    setPrimaryPresets(toPresetState(packs.primary))
    setSecondaryPresets(toPresetState(packs.secondary))
    setPresetSearch('')
  }, [presetLocale])

  // ─── Data fetching ───────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      const [subjectsRes, classesRes] = await Promise.all([
        fetch('/api/subjects'),
        fetch('/api/classes/with-subjects'),
      ])

      if (subjectsRes.ok) {
        const data = await subjectsRes.json()
        setSubjects(Array.isArray(data.subjects) ? data.subjects : [])
      }

      if (classesRes.ok) {
        const data = await classesRes.json()
        setClasses(Array.isArray(data.classes) ? data.classes : [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) fetchAll()
  }, [session, fetchAll])

  // ─── Manual add / edit ───────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingSubject ? `/api/subjects/${editingSubject.id}` : '/api/subjects'
      const method = editingSubject ? 'PUT' : 'POST'
      const passRateValue = formData.passRate.trim() !== '' ? Number(formData.passRate) : null
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, code: formData.code || undefined, passRate: passRateValue }),
      })
      if (res.ok) {
        await fetchAll()
        setShowModal(false)
        resetForm()
        showToast(tAdmin('subjectSaved', 'Subject saved successfully!'), 'success')
      } else {
        const error = await res.json()
        showToast(error.error || tAdmin('failedSaveSubject', 'Failed to save subject'), 'error')
      }
    } catch {
      showToast(tAdmin('failedSaveSubject', 'Failed to save subject'), 'error')
    }
  }

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject)
    setFormData({ name: subject.name, code: subject.code || '', passRate: subject.passRate !== null && subject.passRate !== undefined ? String(subject.passRate) : '' })
    setShowModal(true)
  }

  const handleDelete = async (subject: Subject) => {
    if (deletingSubjectId) return

    // Yield a frame so the menu can close/paint before the dialog mounts (INP).
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

    const isConfirmed = await confirm({
      title: tAdmin('deleteSubjectTitle', 'Delete Subject'),
      description: tAdmin('confirmDeleteSubject', 'Are you sure you want to delete this subject?'),
      variant: 'danger',
      confirmLabel: tCommon('delete', 'Delete'),
      cancelLabel: tCommon('cancel', 'Cancel'),
      loadingLabel: tAdmin('deleting', 'Deleting...'),
      entity: {
        name: subject.name,
        subtitle: subject.code || undefined,
      },
      allowBackdropClose: false,
      allowEscapeClose: false,
    })

    if (!isConfirmed) return

    const previousSubjects = subjects
    const previousClasses = classes

    // Immediate paint: optimistic remove without blanking the page via fetchAll/loading.
    setDeletingSubjectId(subject.id)
    startTransition(() => {
      setSubjects((prev) => prev.filter((item) => item.id !== subject.id))
      setClasses((prev) =>
        prev.map((cls) => ({
          ...cls,
          subjectAssignments: cls.subjectAssignments.filter(
            (assignment) => assignment.subject.id !== subject.id
          ),
        }))
      )
    })

    try {
      const res = await fetch(`/api/subjects/${subject.id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast(tAdmin('subjectDeleted', 'Subject deleted successfully!'), 'success')
      } else {
        const error = await res.json().catch(() => ({}))
        startTransition(() => {
          setSubjects(previousSubjects)
          setClasses(previousClasses)
        })
        showToast(
          error.error || tAdmin('failedDeleteSubject', 'Failed to delete subject'),
          'error'
        )
      }
    } catch {
      startTransition(() => {
        setSubjects(previousSubjects)
        setClasses(previousClasses)
      })
      showToast(tAdmin('failedDeleteSubject', 'Failed to delete subject'), 'error')
    } finally {
      setDeletingSubjectId(null)
    }
  }

  const resetForm = () => {
    setFormData({ name: '', code: '', passRate: '' })
    setEditingSubject(null)
  }

  // ─── Batch presets ───────────────────────────────────────────────────────

  const currentPresets = presetTab === 'primary' ? primaryPresets : secondaryPresets
  const setCurrentPresets = presetTab === 'primary' ? setPrimaryPresets : setSecondaryPresets

  const selectedCount = currentPresets.filter((p) => p.selected).length

  const filteredPresets = useMemo(() => {
    const q = presetSearch.trim().toLowerCase()
    if (!q) return currentPresets.map((preset, index) => ({ preset, index }))
    return currentPresets
      .map((preset, index) => ({ preset, index }))
      .filter(
        ({ preset }) =>
          preset.name.toLowerCase().includes(q) ||
          preset.customCode.toLowerCase().includes(q) ||
          preset.code.toLowerCase().includes(q)
      )
  }, [currentPresets, presetSearch])

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase()
    if (!q) return subjects
    return subjects.filter(
      (subject) =>
        subject.name.toLowerCase().includes(q) ||
        String(subject.code || '')
          .toLowerCase()
          .includes(q)
    )
  }, [subjects, catalogSearch])

  const catalogPageRows = useMemo(() => {
    const start = (catalogPage - 1) * catalogPageSize
    return filteredCatalog.slice(start, start + catalogPageSize)
  }, [filteredCatalog, catalogPage, catalogPageSize])

  const togglePreset = (idx: number) => {
    setCurrentPresets((prev) => prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p)))
  }

  const updatePresetCode = (idx: number, code: string) => {
    setCurrentPresets((prev) => prev.map((p, i) => (i === idx ? { ...p, customCode: code } : p)))
  }

  const selectAllPresets = () => setCurrentPresets((prev) => prev.map((p) => ({ ...p, selected: true })))
  const clearAllPresets = () => setCurrentPresets((prev) => prev.map((p) => ({ ...p, selected: false })))

  const catalogColumns = useMemo(
    () => [
      {
        key: 'name',
        label: tAdmin('subjectName', 'Nom'),
        sortable: true,
        renderCell: (subject: Subject) => (
          <span className="font-medium ui-text-primary">{subject.name}</span>
        ),
      },
      {
        key: 'code',
        label: tAdmin('subjectCodeShort', 'Code'),
        sortable: true,
        renderCell: (subject: Subject) => (
          <span className="ui-text-secondary">{subject.code || '—'}</span>
        ),
      },
      {
        key: 'passRate',
        label: tAdmin('subjectPassRateShort', 'Seuil'),
        sortable: true,
        renderCell: (subject: Subject) =>
          subject.passRate !== null && subject.passRate !== undefined ? (
            <span className="font-semibold">{subject.passRate}%</span>
          ) : (
            <span className="text-xs ui-text-secondary">
              {tAdmin('schoolDefault', 'Défaut école')}
            </span>
          ),
      },
      { key: 'actions', label: tAdmin('tableActions', 'Actions') },
    ],
    [tAdmin]
  )

  const catalogRowActions = (subject: Subject) => [
    {
      label: tCommon('edit', 'Modifier'),
      onClick: () => handleEdit(subject),
    },
    {
      label: tCommon('delete', 'Supprimer'),
      danger: true,
      onClick: () => {
        if (deletingSubjectId) return
        void handleDelete(subject)
      },
    },
  ]

  const handleBatchCreate = async () => {
    const selected = currentPresets.filter((p) => p.selected)
    if (selected.length === 0) {
      showToast(tAdmin('selectAtLeastOne', 'Select at least one subject'), 'warning')
      return
    }
    try {
      setBatchLoading(true)
      const res = await fetch('/api/subjects/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjects: selected.map((p) => ({
            name: p.name,
            code: p.customCode.trim() || undefined,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(tAdmin('failedBatchCreate', 'Failed to add subjects'), 'error')
        return
      }
      await fetchAll()
      setShowPresetsModal(false)
      setPrimaryPresets((prev) => prev.map((p) => ({ ...p, selected: false })))
      setSecondaryPresets((prev) => prev.map((p) => ({ ...p, selected: false })))
      let msg = tAdmin('batchCreated', '{count} subject(s) added to catalog.').replace('{count}', String(data.created))
      if (data.skipped > 0) {
        msg += ' ' + tAdmin('batchSkipped', '{skipped} already existed and were skipped.').replace('{skipped}', String(data.skipped))
      }
      showToast(msg, 'success')
    } catch {
      showToast(tAdmin('failedBatchCreate', 'Failed to add subjects'), 'error')
    } finally {
      setBatchLoading(false)
    }
  }

  // ─── Class accordion ─────────────────────────────────────────────────────

  const toggleClass = (id: string) => {
    setExpandedClassIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (status === 'loading' || !session) {
    return <div>{tCommon('loading', 'Loading...')}</div>
  }

  const navItems = session.user.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS
  const hasClasses = classes.length > 0

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session.user.role === 'DEPUTY_ADMIN' ? 'Deputy Admin' : 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap gap-3 items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold ui-text-primary">{tAdmin('subjectsManagement', 'Subjects Management')}</h1>
            <p className="ui-text-secondary mt-1">{tAdmin('manageSubjectCatalog', 'Manage your school subject catalog.')}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              onClick={() => setShowPresetsModal(true)}
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              {tAdmin('quickAddPresets', 'Quick Add from Presets')}
            </Button>
            <Button
              onClick={() => { resetForm(); setShowModal(true) }}
              className="flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              {tAdmin('addSubjectManually', 'Add Subject Manually')}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-(--border-subtle)">
          {(['byClass', 'catalog'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent ui-text-secondary hover:ui-text-primary'
              }`}
            >
              {tab === 'byClass' ? tAdmin('byClass', 'By Class') : tAdmin('catalog', 'Subject Catalog')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="ui-text-secondary">{tAdmin('loadingSubjects', 'Loading subjects...')}</div>
        ) : (
          <>
            {/* ── By Class tab ── */}
            {activeTab === 'byClass' && (
              <div className="space-y-3">
                {!hasClasses ? (
                  <Card className="p-8 text-center">
                    <p className="ui-text-secondary mb-4">
                      {tAdmin('mustCreateClasses', 'No classes found. Please create classes first before organizing subjects.')}
                    </p>
                    <a href="/admin/classes">
                      <Button className="inline-flex items-center gap-1.5">
                        <School className="h-4 w-4" />
                        {tAdmin('createClassesFirst', 'Create Classes')}
                      </Button>
                    </a>
                  </Card>
                ) : (
                  <>
                    <p className="text-sm ui-text-secondary">
                      {tAdmin('subjectsOrganizedByClass', 'Subjects are organized by class below. Use "Manage" to assign or remove subjects from each class.')}
                    </p>
                    {classes.map((cls) => {
                      const isExpanded = expandedClassIds.has(cls.id)
                      const assignmentCount = cls.subjectAssignments.length
                      return (
                        <Card key={cls.id} className="overflow-hidden">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-(--surface-soft) transition-colors"
                            onClick={() => toggleClass(cls.id)}
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 ui-text-secondary" />
                              ) : (
                                <ChevronRight className="h-4 w-4 ui-text-secondary" />
                              )}
                              <div>
                                <span className="font-semibold ui-text-primary">{cls.name}</span>
                                {cls.grade && (
                                  <span className="ml-2 text-xs ui-text-secondary">• {cls.grade}</span>
                                )}
                                <span className="ml-2 text-xs ui-text-secondary">• {cls.academicYear}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm ui-text-secondary">
                                {tAdmin('subjectsInClass', '{count} subject(s)').replace('{count}', String(assignmentCount))}
                              </span>
                              <a
                                href={`/admin/classes/${cls.id}?tab=teachers`}
                                onClick={(e) => e.stopPropagation()}
                                className="ui-table-link text-xs whitespace-nowrap"
                              >
                                {tAdmin('manageClassSubjects', 'Gérer pour cette classe')}
                              </a>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-(--border-subtle) px-4 pb-4 pt-3">
                              {assignmentCount === 0 ? (
                                <p className="text-sm ui-text-secondary">
                                  {tAdmin('noSubjectsForClass', 'No subjects assigned to this class yet.')}
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {cls.subjectAssignments.map(({ subject, teacher }) => (
                                    <div
                                      key={subject.id}
                                      className="flex items-center gap-2 rounded-lg border border-(--border-subtle) bg-(--surface-soft) px-3 py-2"
                                    >
                                      <BookOpen className="h-4 w-4 ui-text-secondary shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium ui-text-primary truncate">{subject.name}</p>
                                        <p className="text-xs ui-text-secondary">
                                          {subject.code && <span className="mr-2">{subject.code}</span>}
                                          {teacher.firstName} {teacher.lastName}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </>
                )}
              </div>
            )}

            {/* ── Catalog tab ── */}
            {activeTab === 'catalog' && (
              <Table
                title={tAdmin('catalog', 'Catalogue des matières')}
                columns={catalogColumns}
                data={catalogPageRows}
                loading={loading}
                totalCount={filteredCatalog.length}
                page={catalogPage}
                pageSize={catalogPageSize}
                onSearch={(value) => {
                  setCatalogSearch(value)
                  setCatalogPage(1)
                }}
                onPageChange={setCatalogPage}
                emptyMessage={tAdmin('noSubjects', 'Aucune matière dans le catalogue.')}
                getRowActions={catalogRowActions}
                rowKey="id"
              />
            )}
          </>
        )}
      </div>

      {/* ── Manual Add/Edit modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold ui-text-primary mb-4">
              {editingSubject ? tAdmin('editSubject', 'Edit Subject') : tAdmin('addSubjectManually', 'Add Subject Manually')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label={tAdmin('subjectName', 'Subject Name')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder={tAdmin('egMathematics', 'e.g., Mathematics')}
              />
              <Input
                label={tAdmin('subjectCode', 'Subject Code (optional)')}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder={tAdmin('egMath101', 'e.g., MATH')}
              />
              <div>
                <Input
                  label={tAdmin('subjectPassRate', 'Pass Mark % (optional)')}
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={formData.passRate}
                  onChange={(e) => setFormData({ ...formData, passRate: e.target.value })}
                  placeholder={tAdmin('passRatePlaceholder', 'Leave blank to use school default')}
                />
                <p className="mt-1 text-xs ui-text-secondary">{tAdmin('passRateHelp', 'Override the school-wide pass mark for this subject only.')}</p>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="secondary" onClick={() => { setShowModal(false); resetForm() }}>
                  {tCommon('cancel', 'Cancel')}
                </Button>
                <Button type="submit">
                  {editingSubject ? tCommon('save', 'Save') : tCommon('create', 'Create')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ── Quick Add Presets modal ── */}
      {showPresetsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[10px] border border-(--border-subtle) bg-(--surface) p-5">
            <h2 className="text-[1.25rem] font-semibold ui-text-primary">
              {tAdmin('quickAddTitle', 'Ajout rapide depuis les modèles')}
            </h2>
            <p className="mt-1 text-sm ui-text-secondary">
              {tAdmin(
                'quickAddHelp',
                'Sélectionnez des matières ci-dessous et ajoutez-les au catalogue. Les matières déjà présentes seront ignorées.'
              )}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {(['fr', 'en'] as const).map((locale) => (
                <button
                  key={locale}
                  type="button"
                  onClick={() => setPresetLocale(locale)}
                  className={`rounded-[6px] border px-3 py-1.5 text-sm font-medium transition-colors ${
                    presetLocale === locale
                      ? 'border-[#635bff] bg-[#f0effe] text-[#635bff]'
                      : 'border-(--border-subtle) ui-text-secondary hover:ui-text-primary'
                  }`}
                >
                  {locale === 'fr'
                    ? tAdmin('frenchCurriculum', 'Programme français')
                    : tAdmin('englishCurriculum', 'English curriculum')}
                </button>
              ))}
              <span className="mx-1 ui-text-secondary">·</span>
              {(['primary', 'secondary'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => {
                    setPresetTab(level)
                    setPresetSearch('')
                  }}
                  className={`rounded-[6px] border px-3 py-1.5 text-sm font-medium transition-colors ${
                    presetTab === level
                      ? 'border-[#635bff] bg-[#f0effe] text-[#635bff]'
                      : 'border-(--border-subtle) ui-text-secondary hover:ui-text-primary'
                  }`}
                >
                  {level === 'primary'
                    ? tAdmin('primary', 'Primaire')
                    : tAdmin('secondary', 'Secondaire')}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="ui-search-field max-w-[280px] flex-1">
                <Search className="ui-search-field__icon" aria-hidden />
                <input
                  type="search"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder={tAdmin('searchPresets', 'Rechercher une matière...')}
                  className="ui-input ui-input-search w-full"
                />
              </label>
              <button type="button" onClick={selectAllPresets} className="ui-table-link text-sm">
                {tAdmin('selectAll', 'Tout sélectionner')}
              </button>
              <button type="button" onClick={clearAllPresets} className="text-sm ui-text-secondary hover:underline">
                {tAdmin('clearAll', 'Tout effacer')}
              </button>
              <span className="ml-auto text-sm ui-text-secondary">
                {selectedCount} {tCommon('selected', 'sélectionné(s)')} · {filteredPresets.length}/
                {currentPresets.length}
              </span>
            </div>

            <div className="ui-table-wrap mt-3 min-h-0 flex-1 overflow-auto">
              <table className="ui-table no-table-stripes min-w-full">
                <thead>
                  <tr>
                    <th className="w-10" />
                    <th>{tAdmin('subjectName', 'Nom')}</th>
                    <th className="w-28">{tAdmin('autoCodeLabel', 'Code')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPresets.length > 0 ? (
                    filteredPresets.map(({ preset, index }) => (
                      <tr
                        key={`${preset.name}-${index}`}
                        className="cursor-pointer"
                        onClick={() => togglePreset(index)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={preset.selected}
                            onChange={() => togglePreset(index)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={preset.name}
                          />
                        </td>
                        <td className="font-medium ui-text-primary">{preset.name}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={preset.customCode}
                            onChange={(e) => updatePresetCode(index, e.target.value.toUpperCase())}
                            maxLength={10}
                            className="ui-input h-8 min-h-8 w-24 py-0 text-xs uppercase"
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-sm ui-text-secondary">
                        {tAdmin('noSearchMatches', 'Aucune matière ne correspond à la recherche.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t border-(--border-subtle) pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowPresetsModal(false)
                  setPrimaryPresets((p) => p.map((s) => ({ ...s, selected: false })))
                  setSecondaryPresets((p) => p.map((s) => ({ ...s, selected: false })))
                  setPresetSearch('')
                }}
              >
                {tCommon('cancel', 'Annuler')}
              </Button>
              <Button
                className="inline-flex items-center gap-1.5"
                onClick={handleBatchCreate}
                isLoading={batchLoading}
                disabled={selectedCount === 0}
              >
                <Plus className="h-4 w-4" />
                {tAdmin('addSelected', 'Ajouter {count} au catalogue').replace(
                  '{count}',
                  String(selectedCount)
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
