'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Download, Plus, Upload } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import Table from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'

interface ClassRow {
  id: string
  name: string
  academicYear: number
  academicYearId: string | null
  grade: string | null
  teacherId: string | null
  capacity?: number | null
  teacher?: { firstName: string | null; lastName: string | null } | null
  _count?: { students: number }
}

interface AcademicYear {
  id: string
  year: number
  name: string
  isCurrent: boolean
}

interface Teacher {
  id: string
  firstName: string
  lastName: string
}

export default function ClassesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [defaultAcademicYearId, setDefaultAcademicYearId] = useState('')
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkUploadLoading, setBulkUploadLoading] = useState(false)
  const [bulkUploadErrors, setBulkUploadErrors] = useState<Array<{ row: number; error: string }>>([])
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    academicYearId: '',
    teacherId: '',
    capacity: '',
  })

  const preferredLanguage = session?.user?.preferredLanguage || 'fr'
  const languageMessages = useMemo(
    () => (preferredLanguage === 'fr' ? frMessages : preferredLanguage === 'sw' ? swMessages : enMessages),
    [preferredLanguage]
  )
  const adminUi = useMemo(
    () => ((languageMessages as Record<string, unknown>).adminUi || {}) as Record<string, string>,
    [languageMessages]
  )
  const common = useMemo(
    () => ((languageMessages as Record<string, unknown>).common || {}) as Record<string, string>,
    [languageMessages]
  )
  const classesDetail = useMemo(
    () => ((languageMessages as Record<string, unknown>).classesDetail || {}) as Record<string, string>,
    [languageMessages]
  )

  const tAdmin = useCallback((key: string, fallback: string) => adminUi[key] || fallback, [adminUi])
  const tCommon = useCallback((key: string, fallback: string) => common[key] || fallback, [common])
  const t = useCallback((key: string, fallback: string) => classesDetail[key] || fallback, [classesDetail])

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role !== 'SCHOOL_ADMIN' && session?.user?.role !== 'DEPUTY_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/classes')
      if (res.ok) {
        const data = await res.json()
        setClasses(Array.isArray(data.classes) ? data.classes : [])
      } else {
        setClasses([])
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error)
      setClasses([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/users?role=TEACHER')
      if (res.ok) {
        const data = await res.json()
        setTeachers(Array.isArray(data.users) ? data.users : [])
      } else {
        setTeachers([])
      }
    } catch (error) {
      console.error('Failed to fetch teachers:', error)
      setTeachers([])
    }
  }, [])

  const fetchAcademicYears = useCallback(async () => {
    try {
      const res = await fetch('/api/terms')
      if (!res.ok) {
        setAcademicYears([])
        setDefaultAcademicYearId('')
        return
      }
      const data = await res.json()
      const years = Array.isArray(data.academicYears) ? data.academicYears : []
      setAcademicYears(years)
      const currentYear = years.find((year: AcademicYear) => year.isCurrent)
      const selectedId = currentYear?.id ?? years[0]?.id ?? ''
      setDefaultAcademicYearId(selectedId)
      setFormData((prev) => ({ ...prev, academicYearId: prev.academicYearId || selectedId }))
    } catch (error) {
      console.error('Failed to fetch academic years:', error)
      setAcademicYears([])
      setDefaultAcademicYearId('')
    }
  }, [])

  useEffect(() => {
    if (!session) return
    fetchClasses()
    fetchTeachers()
    fetchAcademicYears()
  }, [session, fetchClasses, fetchTeachers, fetchAcademicYears])

  const resetForm = () => {
    setFormData({
      name: '',
      academicYearId: defaultAcademicYearId,
      teacherId: '',
      capacity: '',
    })
    setEditingClass(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingClass ? `/api/classes/${editingClass.id}` : '/api/classes'
      const method = editingClass ? 'PUT' : 'POST'
      const payload = {
        name: formData.name,
        academicYearId: formData.academicYearId,
        teacherId: formData.teacherId || undefined,
        capacity: formData.capacity || undefined,
      }
      if (!payload.academicYearId) {
        showToast(tAdmin('selectAcademicYear', 'Veuillez sélectionner une année scolaire'), 'error')
        return
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        await fetchClasses()
        setShowModal(false)
        resetForm()
        showToast(tAdmin('classSaved', 'Classe enregistrée avec succès !'), 'success')
      } else {
        const error = await res.json()
        const apiError =
          Array.isArray(error.error) && error.error[0]?.message
            ? String(error.error[0].message)
            : typeof error.error === 'string'
              ? error.error
              : tAdmin('failedSaveClass', "Échec de l'enregistrement de la classe")
        showToast(apiError, 'error')
      }
    } catch (error) {
      console.error('Failed to save class:', error)
      showToast(tAdmin('failedSaveClass', "Échec de l'enregistrement de la classe"), 'error')
    }
  }

  const handleEdit = (cls: ClassRow) => {
    const resolvedAcademicYearId =
      cls.academicYearId ||
      academicYears.find((year) => year.year === cls.academicYear)?.id ||
      defaultAcademicYearId
    setEditingClass(cls)
    setFormData({
      name: cls.name,
      academicYearId: resolvedAcademicYearId,
      teacherId: cls.teacherId || '',
      capacity: cls.capacity ? String(cls.capacity) : '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(tAdmin('confirmDeleteClass', 'Êtes-vous sûr de vouloir supprimer cette classe ?'))) return
    try {
      const res = await fetch(`/api/classes/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok || res.status === 202) {
        showToast(
          data.message ||
            tAdmin(
              'classDeletionRequested',
              "Demande de suppression de classe soumise. En attente d'approbation d'un autre administrateur."
            ),
          'success'
        )
        await fetchClasses()
      } else {
        showToast(data.error || tAdmin('failedDeleteClass', 'Échec de la suppression de la classe'), 'error')
      }
    } catch (error) {
      console.error('Failed to delete class:', error)
      showToast(tAdmin('failedDeleteClass', 'Échec de la suppression de la classe'), 'error')
    }
  }

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBulkUploadLoading(true)
    setBulkUploadErrors([])
    try {
      const formDataToSend = new FormData()
      formDataToSend.append('file', file)
      const res = await fetch('/api/classes/bulk-upload', { method: 'POST', body: formDataToSend })
      const data = await res.json()
      if (res.ok) {
        await fetchClasses()
        setShowBulkModal(false)
        showToast(
          tAdmin('bulkCreatedClasses', '{n} classe(s) créée(s) !').replace('{n}', String(data.created)),
          'success'
        )
      } else if (data.errors?.length) {
        setBulkUploadErrors(data.errors)
        showToast(
          tAdmin('bulkFailedClasses', 'Échec pour {n} ligne(s).').replace('{n}', String(data.failed)),
          'error'
        )
      } else {
        showToast(data.error || tAdmin('failedUploadClasses', "Échec de l'importation des classes"), 'error')
      }
    } catch (error) {
      console.error('Failed to upload classes:', error)
      showToast(tAdmin('failedUploadClasses', "Échec de l'importation des classes"), 'error')
    } finally {
      setBulkUploadLoading(false)
    }
  }

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/api/classes/bulk-upload/template')
      if (!res.ok) return
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'classes-bulk-upload-template.xlsx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to download template:', error)
      showToast(tAdmin('failedDownloadTemplate', 'Échec du téléchargement du modèle'), 'error')
    }
  }

  const yearOptions = useMemo(() => {
    const years = Array.from(new Set(classes.map((c) => c.academicYear))).sort((a, b) => b - a)
    return years.map((year) => ({ value: String(year), label: String(year) }))
  }, [classes])

  const filteredClasses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return classes.filter((cls) => {
      if (yearFilter && String(cls.academicYear) !== yearFilter) return false
      if (!query) return true
      const teacherName = cls.teacher
        ? `${cls.teacher.firstName || ''} ${cls.teacher.lastName || ''}`.trim().toLowerCase()
        : ''
      return (
        cls.name.toLowerCase().includes(query) ||
        String(cls.grade || '')
          .toLowerCase()
          .includes(query) ||
        String(cls.academicYear).includes(query) ||
        teacherName.includes(query)
      )
    })
  }, [classes, searchTerm, yearFilter])

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredClasses.slice(start, start + pageSize)
  }, [filteredClasses, currentPage])

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: t('colName', 'Nom'),
        sortable: true,
        renderCell: (cls: ClassRow) => <span className="font-medium ui-text-primary">{cls.name}</span>,
      },
      {
        key: 'grade',
        label: t('colGrade', 'Niveau'),
        renderCell: (cls: ClassRow) => cls.grade || '—',
      },
      {
        key: 'academicYear',
        label: t('colYear', 'Année'),
        sortable: true,
      },
      {
        key: 'teacher',
        label: t('colHomeroom', 'Titulaire'),
        renderCell: (cls: ClassRow) =>
          cls.teacher
            ? `${cls.teacher.firstName || ''} ${cls.teacher.lastName || ''}`.trim() || '—'
            : '—',
      },
      {
        key: 'students',
        label: t('colStudents', 'Élèves'),
        renderCell: (cls: ClassRow) => {
          const count = cls._count?.students || 0
          return cls.capacity ? `${count} / ${cls.capacity}` : String(count)
        },
      },
      { key: 'actions', label: t('colActions', 'Actions') },
    ],
    [t]
  )

  const getRowActions = (cls: ClassRow) => [
    {
      label: t('actionOpen', 'Ouvrir'),
      onClick: () => router.push(`/admin/classes/${cls.id}`),
    },
    {
      label: tCommon('edit', 'Modifier'),
      onClick: () => handleEdit(cls),
    },
    {
      label: t('actionManageStudents', 'Gérer les élèves'),
      onClick: () => router.push(`/admin/classes/${cls.id}?tab=students`),
    },
    {
      label: t('actionManageSubjects', 'Gérer les matières'),
      onClick: () => router.push(`/admin/classes/${cls.id}?tab=teachers`),
    },
    {
      label: tCommon('delete', 'Supprimer'),
      danger: true,
      onClick: () => handleDelete(cls.id),
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold ui-text-primary">
              {tAdmin('classesManagement', 'Gestion des classes')}
            </h1>
            <p className="mt-1 text-sm ui-text-secondary">
              {tAdmin('manageClasses', 'Gérez toutes les classes de votre école')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="inline-flex items-center gap-1.5"
              onClick={() => {
                setShowBulkModal(true)
                setBulkUploadErrors([])
              }}
            >
              <Upload className="h-4 w-4" />
              {tAdmin('bulkUploadClasses', 'Importation en lot des classes')}
            </Button>
            <Button
              className="inline-flex items-center gap-1.5"
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
            >
              <Plus className="h-4 w-4" />
              {tAdmin('addClass', 'Ajouter une classe')}
            </Button>
          </div>
        </div>

        <Table
          title={tAdmin('classesManagement', 'Gestion des classes')}
          columns={columns}
          data={pageRows}
          loading={loading}
          totalCount={filteredClasses.length}
          page={currentPage}
          pageSize={pageSize}
          onSearch={(value) => {
            setSearchTerm(value)
            setCurrentPage(1)
          }}
          onPageChange={setCurrentPage}
          filterLabel={t('filterYear', 'Année')}
          filterOptions={[{ value: '', label: t('allYears', 'Toutes les années') }, ...yearOptions]}
          activeFilter={yearFilter}
          onFilterChange={(value) => {
            setYearFilter(value)
            setCurrentPage(1)
          }}
          getRowActions={getRowActions}
          onRowClick={(cls) => router.push(`/admin/classes/${cls.id}`)}
          rowKey="id"
          emptyMessage={
            searchTerm.trim() || yearFilter
              ? t('noSearchResults', 'Aucune classe ne correspond à votre recherche.')
              : tAdmin('noClasses', 'Aucune classe trouvée. Cliquez sur « Ajouter une classe » pour en créer une.')
          }
          ariaLabel={tAdmin('classesManagement', 'Gestion des classes')}
        />
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <div className="w-full max-w-md rounded-[10px] border border-(--border-subtle) bg-(--surface) p-5">
            <h2 className="text-[20px] font-semibold ui-text-primary">
              {editingClass ? tAdmin('editClass', 'Modifier la classe') : tAdmin('addClass', 'Ajouter une classe')}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <Input
                label={tAdmin('className', 'Nom de la classe')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder={tAdmin('egGrade', 'ex. : Grade 5A')}
              />
              <Select
                label={tAdmin('academicYear', 'Année scolaire')}
                value={formData.academicYearId}
                onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
                required
              >
                <option value="">{tAdmin('selectAcademicYear', 'Sélectionner une année scolaire')}</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name} ({year.year})
                  </option>
                ))}
              </Select>
              <Select
                label={tAdmin('classTeacher', 'Enseignant de classe')}
                value={formData.teacherId}
                onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
              >
                <option value="">{tAdmin('assignLater', 'Assigner plus tard')}</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.firstName} {teacher.lastName}
                  </option>
                ))}
              </Select>
              <Input
                label={tAdmin('classCapacity', 'Capacité de la classe')}
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                min={1}
                max={500}
                placeholder={tAdmin('egCapacity', 'ex. : 40')}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                >
                  {tCommon('cancel', 'Annuler')}
                </Button>
                <Button type="submit">
                  {editingClass ? tCommon('update', 'Mettre à jour') : tCommon('create', 'Créer')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showBulkModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[10px] border border-(--border-subtle) bg-(--surface) p-5">
            <h2 className="text-[20px] font-semibold ui-text-primary">
              {tAdmin('bulkUploadClasses', 'Importation en lot des classes')}
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <Button
                  variant="secondary"
                  onClick={downloadTemplate}
                  className="mb-3 inline-flex items-center gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  {tAdmin('downloadTemplate', 'Télécharger le modèle')}
                </Button>
                <p className="text-sm ui-text-secondary">
                  {tAdmin(
                    'classesTemplateHelp',
                    'Téléchargez le modèle Excel, remplissez les détails de la classe, puis importez-le ici.'
                  )}
                </p>
              </div>
              <div className="rounded-[10px] border border-dashed border-(--border-subtle) p-8 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleBulkUpload}
                  disabled={bulkUploadLoading}
                  className="hidden"
                  id="bulk-file-input-classes"
                />
                <label htmlFor="bulk-file-input-classes" className="cursor-pointer">
                  <p className="font-medium ui-text-primary">
                    {bulkUploadLoading
                      ? tAdmin('uploading', 'Importation...')
                      : tAdmin('clickUploadOrDrag', 'Cliquez pour importer ou glissez-déposez')}
                  </p>
                  <p className="mt-1 text-sm ui-text-secondary">
                    {tAdmin('excelMax5mb', 'Fichiers Excel (.xlsx, .xls) - Max 5MB')}
                  </p>
                </label>
              </div>
              {bulkUploadErrors.length > 0 ? (
                <div className="rounded-[10px] border border-(--border-subtle) bg-(--surface-soft) p-4">
                  <h3 className="mb-2 font-semibold text-[var(--danger)]">
                    {tAdmin('uploadErrors', "Erreurs d'importation")}
                  </h3>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {bulkUploadErrors.map((err, idx) => (
                      <p key={idx} className="text-sm text-[var(--danger)]">
                        <strong>
                          {tAdmin('row', 'Ligne')} {err.row}:
                        </strong>{' '}
                        {err.error}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowBulkModal(false)
                    setBulkUploadErrors([])
                  }}
                >
                  {tCommon('cancel', 'Fermer')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  )
}
