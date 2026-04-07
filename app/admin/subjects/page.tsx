'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { Barcode, BookOpen, ChevronDown, ChevronRight, MoreHorizontal, PencilLine, Trash2, Zap } from 'lucide-react'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject {
  id: string
  name: string
  code: string | null
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

// ─── Preset subject lists ─────────────────────────────────────────────────────

const PRIMARY_PRESETS: Array<{ name: string; code: string }> = [
  { name: 'Mathematics', code: 'MATH' },
  { name: 'English Language', code: 'ENG' },
  { name: 'Kiswahili', code: 'KSW' },
  { name: 'Science', code: 'SCI' },
  { name: 'Social Studies', code: 'SST' },
  { name: 'Religious Education', code: 'RE' },
  { name: 'Creative Arts', code: 'ART' },
  { name: 'Physical Education', code: 'PE' },
  { name: 'Computer Studies', code: 'COMP' },
  { name: 'Life Skills', code: 'LS' },
  { name: 'Environmental Studies', code: 'ENV' },
  { name: 'Health Education', code: 'HE' },
]

const SECONDARY_PRESETS: Array<{ name: string; code: string }> = [
  { name: 'Mathematics', code: 'MATH' },
  { name: 'English Language', code: 'ENG' },
  { name: 'Kiswahili', code: 'KSW' },
  { name: 'Physics', code: 'PHY' },
  { name: 'Chemistry', code: 'CHEM' },
  { name: 'Biology', code: 'BIO' },
  { name: 'History', code: 'HIST' },
  { name: 'Geography', code: 'GEO' },
  { name: 'Civics', code: 'CIV' },
  { name: 'Commerce', code: 'COM' },
  { name: 'Economics', code: 'ECON' },
  { name: 'Literature', code: 'LIT' },
  { name: 'Computer Science', code: 'CS' },
  { name: 'Agriculture', code: 'AGR' },
  { name: 'Business Studies', code: 'BUS' },
  { name: 'Fine Arts', code: 'ART' },
  { name: 'Physical Education', code: 'PE' },
  { name: 'Religious Education', code: 'RE' },
  { name: 'French', code: 'FRE' },
  { name: 'Arabic', code: 'ARB' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubjectsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  // Data
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [activeTab, setActiveTab] = useState<'byClass' | 'catalog'>('byClass')
  const [expandedClassIds, setExpandedClassIds] = useState<Set<string>>(new Set())
  const [openSubjectMenuId, setOpenSubjectMenuId] = useState<string | null>(null)
  const subjectMenuRef = useRef<HTMLDivElement | null>(null)

  // Manual add/edit modal
  const [showModal, setShowModal] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [formData, setFormData] = useState({ name: '', code: '' })

  // Quick-add presets modal
  const [showPresetsModal, setShowPresetsModal] = useState(false)
  const [presetTab, setPresetTab] = useState<'primary' | 'secondary'>('primary')
  const [primaryPresets, setPrimaryPresets] = useState<PresetSubject[]>(
    PRIMARY_PRESETS.map((p) => ({ ...p, selected: false, customCode: p.code }))
  )
  const [secondaryPresets, setSecondaryPresets] = useState<PresetSubject[]>(
    SECONDARY_PRESETS.map((p) => ({ ...p, selected: false, customCode: p.code }))
  )
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

  // ─── Close menu on outside click ────────────────────────────────────────

  useEffect(() => {
    if (!openSubjectMenuId) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!subjectMenuRef.current?.contains(event.target as Node)) setOpenSubjectMenuId(null)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenSubjectMenuId(null)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openSubjectMenuId])

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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, code: formData.code || undefined }),
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
    setFormData({ name: subject.name, code: subject.code || '' })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(tAdmin('confirmDeleteSubject', 'Are you sure you want to delete this subject?'))) return
    try {
      const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchAll()
        showToast(tAdmin('subjectDeleted', 'Subject deleted successfully!'), 'success')
      } else {
        const error = await res.json()
        showToast(error.error || tAdmin('failedDeleteSubject', 'Failed to delete subject'), 'error')
      }
    } catch {
      showToast(tAdmin('failedDeleteSubject', 'Failed to delete subject'), 'error')
    }
  }

  const resetForm = () => {
    setFormData({ name: '', code: '' })
    setEditingSubject(null)
  }

  // ─── Batch presets ───────────────────────────────────────────────────────

  const currentPresets = presetTab === 'primary' ? primaryPresets : secondaryPresets
  const setCurrentPresets = presetTab === 'primary' ? setPrimaryPresets : setSecondaryPresets

  const selectedCount = currentPresets.filter((p) => p.selected).length

  const togglePreset = (idx: number) => {
    setCurrentPresets((prev) => prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p)))
  }

  const updatePresetCode = (idx: number, code: string) => {
    setCurrentPresets((prev) => prev.map((p, i) => (i === idx ? { ...p, customCode: code } : p)))
  }

  const selectAllPresets = () => setCurrentPresets((prev) => prev.map((p) => ({ ...p, selected: true })))
  const clearAllPresets = () => setCurrentPresets((prev) => prev.map((p) => ({ ...p, selected: false })))

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
                      <Button>{tAdmin('createClassesFirst', 'Create Classes')}</Button>
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
                                href={`/admin/classes/${cls.id}/subjects`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                              >
                                {tAdmin('manageClassSubjects', 'Manage for this class')}
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
              <div>
                {subjects.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="ui-text-secondary">{tAdmin('noSubjects', 'No subjects in catalog yet.')}</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subjects.map((subject) => (
                      <Card key={subject.id} className={`p-5 relative ${openSubjectMenuId === subject.id ? 'z-30' : 'z-0'}`}>
                        <div
                          className="flex items-start justify-between gap-2"
                          ref={openSubjectMenuId === subject.id ? subjectMenuRef : undefined}
                        >
                          <div className="min-w-0">
                            <h3 className="font-semibold ui-text-primary truncate">{subject.name}</h3>
                            {subject.code && (
                              <p className="flex items-center gap-1 text-sm ui-text-secondary mt-1">
                                <Barcode className="h-3.5 w-3.5" />
                                {subject.code}
                              </p>
                            )}
                          </div>
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              aria-label="Subject actions"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--border-subtle) bg-(--surface-soft) ui-text-secondary hover:ui-text-primary"
                              onClick={() => setOpenSubjectMenuId((prev) => (prev === subject.id ? null : subject.id))}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {openSubjectMenuId === subject.id && (
                              <div className="absolute right-0 top-9 z-50 min-w-36 rounded-[10px] border border-(--border-subtle) bg-(--surface) p-1.5 shadow-(--shadow-soft)">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ui-text-secondary hover:bg-(--surface-soft) hover:ui-text-primary"
                                  onClick={() => { setOpenSubjectMenuId(null); handleEdit(subject) }}
                                >
                                  <PencilLine className="h-4 w-4" />
                                  {tCommon('edit', 'Edit')}
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                                  onClick={() => { setOpenSubjectMenuId(null); handleDelete(subject.id) }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {tCommon('delete', 'Delete')}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold ui-text-primary mb-1 shrink-0">
              {tAdmin('quickAddTitle', 'Quick Add Subjects from Presets')}
            </h2>
            <p className="text-sm ui-text-secondary mb-4 shrink-0">
              {tAdmin('quickAddHelp', 'Select subjects below and click "Add to Catalog". Subjects already in your catalog will be skipped.')}
            </p>

            {/* Preset level tabs */}
            <div className="flex gap-1 mb-4 shrink-0">
              {(['primary', 'secondary'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setPresetTab(level)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    presetTab === level
                      ? 'bg-blue-600 text-white'
                      : 'bg-(--surface-soft) ui-text-secondary hover:ui-text-primary border border-(--border-subtle)'
                  }`}
                >
                  {level === 'primary' ? tAdmin('primary', 'Primary') : tAdmin('secondary', 'Secondary')}
                </button>
              ))}
            </div>

            {/* Select/clear all */}
            <div className="flex gap-2 mb-3 shrink-0 items-center">
              <button type="button" onClick={selectAllPresets} className="text-sm text-blue-600 hover:underline">
                {tAdmin('selectAll', 'Select All')}
              </button>
              <span className="ui-text-secondary">·</span>
              <button type="button" onClick={clearAllPresets} className="text-sm ui-text-secondary hover:ui-text-primary hover:underline">
                {tAdmin('clearAll', 'Clear All')}
              </button>
              <span className="ml-auto text-sm ui-text-secondary">
                {selectedCount} {tCommon('selected', 'selected')}
              </span>
            </div>

            {/* Presets list */}
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {currentPresets.map((preset, idx) => (
                <div
                  key={preset.name}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors cursor-pointer select-none ${
                    preset.selected
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-(--border-subtle) bg-(--surface-soft) hover:bg-(--surface)'
                  }`}
                  onClick={() => togglePreset(idx)}
                >
                  <input
                    type="checkbox"
                    checked={preset.selected}
                    onChange={() => togglePreset(idx)}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  />
                  <span className="flex-1 text-sm font-medium ui-text-primary">{preset.name}</span>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs ui-text-secondary">{tAdmin('autoCodeLabel', 'Code')}:</span>
                    <input
                      type="text"
                      value={preset.customCode}
                      onChange={(e) => updatePresetCode(idx, e.target.value.toUpperCase())}
                      placeholder={tAdmin('codeOptionalHint', 'optional')}
                      maxLength={10}
                      className="w-20 px-2 py-0.5 text-xs border border-(--border-subtle) rounded bg-(--surface) ui-text-primary uppercase"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end pt-4 shrink-0 border-t border-(--border-subtle) mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowPresetsModal(false)
                  setPrimaryPresets((p) => p.map((s) => ({ ...s, selected: false })))
                  setSecondaryPresets((p) => p.map((s) => ({ ...s, selected: false })))
                }}
              >
                {tCommon('cancel', 'Cancel')}
              </Button>
              <Button
                onClick={handleBatchCreate}
                isLoading={batchLoading}
                disabled={selectedCount === 0}
              >
                {tAdmin('addSelected', 'Add {count} to Catalog').replace('{count}', String(selectedCount))}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  )
}
