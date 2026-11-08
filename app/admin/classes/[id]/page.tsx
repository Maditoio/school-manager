'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Save, UserPlus } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import {
  ActionMenu,
  DetailBreadcrumb,
  DetailHeader,
  DetailMetaLabel,
  DetailSearchInput,
  DetailShell,
  DetailTabs,
  DetailToolbar,
  KpiStrip,
  StatusPill,
  type ActionMenuItem,
} from '@/components/admin/detail'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import { useToast } from '@/components/ui/Toast'
import { useConfirmDialog } from '@/lib/useConfirmDialog'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'

type TabKey = 'students' | 'teachers' | 'attendance' | 'grades'

type OverviewResponse = {
  class: {
    id: string
    name: string
    grade: string | null
    capacity: number | null
    academicYear: number
    academicYearId: string | null
    academicYearName: string | null
    teacherId: string | null
    teacher: { id: string; firstName: string | null; lastName: string | null; email: string } | null
  }
  summary: {
    studentCount: number
    teacherCount: number
    subjectCount: number
    attendanceRate: number | null
    attendanceSummary: { present: number; absent: number; late: number }
    averageScore: number | null
  }
  teachers: Array<{
    teacherId: string
    isHomeroom: boolean
    teacher: { id: string; firstName: string | null; lastName: string | null; email: string }
    subjects: Array<{ id: string; name: string; code: string | null; assignmentId: string }>
  }>
  students: Array<{
    id: string
    firstName: string
    lastName: string
    admissionNumber: string | null
    status: 'ACTIVE' | 'LEFT'
    gender: 'MALE' | 'FEMALE' | null
    enrollmentType: 'primary' | 'additional'
  }>
  recentAttendance: Array<{
    id: string
    date: string
    status: 'PRESENT' | 'ABSENT' | 'LATE'
    notes: string | null
    student: { id: string; firstName: string; lastName: string }
  }>
  results: Array<{
    id: string
    term: string
    year: number
    totalScore: number | null
    maxScore: number
    grade: string | null
    student: { id: string; firstName: string; lastName: string }
    subject: { id: string; name: string; code: string | null }
  }>
}

type TeacherOption = { id: string; firstName: string; lastName: string }
type SubjectOption = { id: string; name: string; code: string | null }
type AvailableStudent = {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string | null
  class?: { id: string; name: string } | null
}

function personName(person: { firstName: string | null; lastName: string | null } | null | undefined) {
  if (!person) return null
  return `${person.firstName || ''} ${person.lastName || ''}`.trim() || null
}

export default function ClassOverviewPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const classId = params?.id
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { confirm } = useConfirmDialog()

  const preferredLanguage = session?.user?.preferredLanguage || 'fr'
  const dateLocale = preferredLanguage === 'sw' ? 'sw-TZ' : preferredLanguage === 'en' ? 'en-GB' : 'fr-FR'
  const languageMessages = useMemo(
    () => (preferredLanguage === 'fr' ? frMessages : preferredLanguage === 'sw' ? swMessages : enMessages),
    [preferredLanguage]
  )
  const detailMessages = useMemo(
    () => ((languageMessages as Record<string, unknown>).classesDetail || {}) as Record<string, string>,
    [languageMessages]
  )
  const common = useMemo(
    () => ((languageMessages as Record<string, unknown>).common || {}) as Record<string, string>,
    [languageMessages]
  )
  const t = useCallback((key: string, fallback: string) => detailMessages[key] || fallback, [detailMessages])
  const tCommon = useCallback((key: string, fallback: string) => common[key] || fallback, [common])

  const initialTab = (searchParams.get('tab') as TabKey | null) || 'students'
  const [activeTab, setActiveTab] = useState<TabKey>(
    ['students', 'teachers', 'attendance', 'grades'].includes(initialTab) ? initialTab : 'students'
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<OverviewResponse | null>(null)
  const [studentSearch, setStudentSearch] = useState('')
  const [teachersList, setTeachersList] = useState<TeacherOption[]>([])
  const [subjectsList, setSubjectsList] = useState<SubjectOption[]>([])
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([])

  const [showAddTeacher, setShowAddTeacher] = useState(false)
  const [showAssignSubjects, setShowAssignSubjects] = useState(false)
  const [assignTeacherId, setAssignTeacherId] = useState('')
  const [teacherForm, setTeacherForm] = useState({
    teacherId: '',
    subjectIds: [] as string[],
    setAsHomeroom: false,
  })
  const [assignSubjectIds, setAssignSubjectIds] = useState<string[]>([])
  const [savingTeacher, setSavingTeacher] = useState(false)
  const [showAddStudents, setShowAddStudents] = useState(false)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [availableStudentSearch, setAvailableStudentSearch] = useState('')
  const [addingStudents, setAddingStudents] = useState(false)
  const [editClassOpen, setEditClassOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', teacherId: '', capacity: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role !== 'SCHOOL_ADMIN' && session?.user?.role !== 'DEPUTY_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    const tab = searchParams.get('tab') as TabKey | null
    if (tab && ['students', 'teachers', 'attendance', 'grades'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const loadOverview = useCallback(async (options?: { soft?: boolean }) => {
    if (!classId || !session?.user) return
    const soft = Boolean(options?.soft)
    try {
      if (!soft) {
        setLoading(true)
        setError('')
      }
      const res = await fetch(`/api/classes/${classId}/overview`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (!soft) {
          setError(body.error || t('loadError', 'Échec du chargement de la classe'))
          setData(null)
        } else {
          showToast(body.error || t('loadError', 'Échec du chargement de la classe'), 'error')
        }
        return
      }
      setData((await res.json()) as OverviewResponse)
      if (!soft) setError('')
    } catch (loadError) {
      console.error('Failed to load class overview:', loadError)
      if (!soft) {
        setError(t('loadError', 'Échec du chargement de la classe'))
        setData(null)
      } else {
        showToast(t('loadError', 'Échec du chargement de la classe'), 'error')
      }
    } finally {
      if (!soft) setLoading(false)
    }
  }, [classId, session?.user, showToast, t])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  useEffect(() => {
    if (!session?.user) return
    const loadLookups = async () => {
      try {
        const [teachersRes, subjectsRes] = await Promise.all([
          fetch('/api/users?role=TEACHER'),
          fetch('/api/subjects'),
        ])
        if (teachersRes.ok) {
          const payload = await teachersRes.json()
          setTeachersList(Array.isArray(payload.users) ? payload.users : [])
        }
        if (subjectsRes.ok) {
          const payload = await subjectsRes.json()
          setSubjectsList(Array.isArray(payload.subjects) ? payload.subjects : Array.isArray(payload) ? payload : [])
        }
      } catch (lookupError) {
        console.error('Failed to load teacher/subject lookups:', lookupError)
      }
    }
    loadLookups()
  }, [session?.user])

  const formatDate = useCallback(
    (value: string) => new Date(value).toLocaleDateString(dateLocale),
    [dateLocale]
  )

  const setTab = (tab: TabKey) => {
    setActiveTab(tab)
    router.replace(`/admin/classes/${classId}?tab=${tab}`, { scroll: false })
  }

  const openAddTeacher = () => {
    setTeacherForm({ teacherId: '', subjectIds: [], setAsHomeroom: !data?.class.teacherId })
    setShowAddTeacher(true)
  }

  const openAssignSubjects = (teacherId: string) => {
    setAssignTeacherId(teacherId)
    setAssignSubjectIds([])
    setShowAssignSubjects(true)
  }

  const handleAddTeacher = async (event: FormEvent) => {
    event.preventDefault()
    if (!classId || !teacherForm.teacherId) {
      showToast(t('toastSelectTeacher', 'Sélectionnez un enseignant'), 'error')
      return
    }
    setSavingTeacher(true)
    try {
      const res = await fetch(`/api/classes/${classId}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: teacherForm.teacherId,
          subjectIds: teacherForm.subjectIds,
          setAsHomeroom: teacherForm.setAsHomeroom,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(body.error || t('toastAddTeacherFailed', "Échec de l'ajout de l'enseignant"), 'error')
        return
      }
      showToast(
        teacherForm.subjectIds.length > 0
          ? t('toastTeacherAssigned', 'Enseignant et matières enregistrés')
          : t('toastTeacherAddedLater', 'Enseignant ajouté — matières à assigner plus tard'),
        'success'
      )
      setShowAddTeacher(false)
      await loadOverview({ soft: true })
    } catch (saveError) {
      console.error('Failed to add teacher:', saveError)
      showToast(t('toastAddTeacherFailed', "Échec de l'ajout de l'enseignant"), 'error')
    } finally {
      setSavingTeacher(false)
    }
  }

  const handleAssignSubjects = async (event: FormEvent) => {
    event.preventDefault()
    if (!classId || !assignTeacherId || assignSubjectIds.length === 0) {
      showToast(t('toastSelectSubjects', 'Sélectionnez au moins une matière'), 'error')
      return
    }
    setSavingTeacher(true)
    try {
      const res = await fetch(`/api/classes/${classId}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: assignTeacherId,
          subjectIds: assignSubjectIds,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(body.error || t('toastAssignFailed', "Échec de l'assignation"), 'error')
        return
      }
      showToast(t('toastSubjectsAssigned', 'Matières assignées'), 'success')
      setShowAssignSubjects(false)
      await loadOverview({ soft: true })
    } catch (assignError) {
      console.error('Failed to assign subjects:', assignError)
      showToast(t('toastAssignFailed', "Échec de l'assignation"), 'error')
    } finally {
      setSavingTeacher(false)
    }
  }

  const handleRemoveSubject = async (assignment: {
    assignmentId: string
    subjectId: string
    subjectName: string
    teacherId: string
  }) => {
    if (!classId) return

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

    const isConfirmed = await confirm({
      title: t('confirmRemoveSubjectTitle', 'Retirer la matière'),
      description: t(
        'confirmRemoveSubject',
        'Retirer cette matière de cet enseignant pour cette classe ?'
      ),
      variant: 'danger',
      confirmLabel: t('remove', 'Retirer'),
      cancelLabel: tCommon('cancel', 'Annuler'),
      entity: { name: assignment.subjectName },
      allowBackdropClose: false,
      allowEscapeClose: false,
    })
    if (!isConfirmed) return

    // Optimistic UI — avoid full-page loading flash
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        teachers: prev.teachers.map((group) =>
          group.teacherId === assignment.teacherId
            ? {
                ...group,
                subjects: group.subjects.filter((s) => s.assignmentId !== assignment.assignmentId),
              }
            : group
        ),
        summary: {
          ...prev.summary,
          subjectCount: Math.max(0, prev.summary.subjectCount - 1),
        },
      }
    })

    try {
      const res = await fetch(
        `/api/classes/${classId}/subjects?assignmentId=${encodeURIComponent(assignment.assignmentId)}`,
        { method: 'DELETE' }
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(body.error || t('toastRemoveSubjectFailed', 'Échec du retrait de la matière'), 'error')
        await loadOverview({ soft: true })
        return
      }
      showToast(t('toastSubjectRemoved', 'Matière retirée'), 'success')
      await loadOverview({ soft: true })
    } catch (removeError) {
      console.error('Failed to remove subject:', removeError)
      showToast(t('toastRemoveSubjectFailed', 'Échec du retrait de la matière'), 'error')
      await loadOverview({ soft: true })
    }
  }

  const openAddStudents = async () => {
    if (!classId) return
    try {
      const res = await fetch(`/api/classes/${classId}/students?available=true`)
      if (res.ok) {
        const payload = await res.json()
        setAvailableStudents(Array.isArray(payload.students) ? payload.students : [])
      } else {
        setAvailableStudents([])
      }
    } catch {
      setAvailableStudents([])
    }
    setSelectedStudentIds([])
    setAvailableStudentSearch('')
    setShowAddStudents(true)
  }

  const filteredAvailableStudents = useMemo(() => {
    const query = availableStudentSearch.trim().toLowerCase()
    if (!query) return availableStudents
    return availableStudents.filter((student) => {
      const name = `${student.firstName} ${student.lastName}`.toLowerCase()
      const admission = String(student.admissionNumber || '').toLowerCase()
      const className = String(student.class?.name || '').toLowerCase()
      return name.includes(query) || admission.includes(query) || className.includes(query)
    })
  }, [availableStudents, availableStudentSearch])

  const handleAddStudents = async (event: FormEvent) => {
    event.preventDefault()
    if (!classId || selectedStudentIds.length === 0) {
      showToast(t('toastSelectStudents', 'Sélectionnez au moins un élève'), 'error')
      return
    }
    setAddingStudents(true)
    try {
      const res = await fetch(`/api/classes/${classId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: selectedStudentIds }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(body.error || t('toastAddStudentsFailed', "Échec de l'ajout des élèves"), 'error')
        return
      }
      showToast(t('toastStudentsAdded', 'Élèves ajoutés'), 'success')
      setShowAddStudents(false)
      await loadOverview({ soft: true })
    } catch (addError) {
      console.error('Failed to add students:', addError)
      showToast(t('toastAddStudentsFailed', "Échec de l'ajout des élèves"), 'error')
    } finally {
      setAddingStudents(false)
    }
  }

  const handleRemoveStudent = async (
    studentId: string,
    enrollmentType: 'primary' | 'additional' = 'primary',
    studentName?: string
  ) => {
    if (!classId) return

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

    const isConfirmed = await confirm({
      title: t('confirmRemoveStudentTitle', "Retirer l'élève"),
      description: t('confirmRemoveStudent', 'Retirer cet élève de la classe ?'),
      variant: 'danger',
      confirmLabel: t('remove', 'Retirer'),
      cancelLabel: tCommon('cancel', 'Annuler'),
      entity: studentName ? { name: studentName } : undefined,
      allowBackdropClose: false,
      allowEscapeClose: false,
    })
    if (!isConfirmed) return

    try {
      const res = await fetch(`/api/classes/${classId}/students`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, enrollmentType }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(body.error || t('toastRemoveStudentFailed', "Échec du retrait de l'élève"), 'error')
        return
      }
      showToast(t('toastStudentRemoved', 'Élève retiré'), 'success')
      await loadOverview({ soft: true })
    } catch (removeError) {
      console.error('Failed to remove student:', removeError)
      showToast(t('toastRemoveStudentFailed', "Échec du retrait de l'élève"), 'error')
    }
  }

  const openEditClass = () => {
    if (!data) return
    setEditForm({
      name: data.class.name,
      teacherId: data.class.teacherId || '',
      capacity: data.class.capacity ? String(data.class.capacity) : '',
    })
    setEditClassOpen(true)
  }

  const handleSaveClass = async (event: FormEvent) => {
    event.preventDefault()
    if (!classId || !data) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          academicYearId: data.class.academicYearId,
          teacherId: editForm.teacherId || undefined,
          capacity: editForm.capacity || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(body.error || t('toastEditFailed', 'Échec de la modification'), 'error')
        return
      }
      showToast(t('toastClassUpdated', 'Classe mise à jour'), 'success')
      setEditClassOpen(false)
      await loadOverview({ soft: true })
    } catch (editError) {
      console.error('Failed to edit class:', editError)
      showToast(t('toastEditFailed', 'Échec de la modification'), 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteClass = async () => {
    if (!classId || !data) return

    const isConfirmed = await confirm({
      title: t('confirmDeleteClassTitle', 'Supprimer la classe'),
      description: t('confirmDeleteClass', 'Demander la suppression de cette classe ?'),
      variant: 'danger',
      confirmLabel: tCommon('delete', 'Supprimer'),
      cancelLabel: tCommon('cancel', 'Annuler'),
      entity: { name: data.class.name },
      allowBackdropClose: false,
      allowEscapeClose: false,
    })
    if (!isConfirmed) return

    try {
      const res = await fetch(`/api/classes/${classId}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 202) {
        showToast(body.error || t('toastDeleteFailed', 'Échec de la suppression'), 'error')
        return
      }
      showToast(
        body.message || t('toastDeleteRequested', 'Demande de suppression soumise'),
        'success'
      )
      router.push('/admin/classes')
    } catch (deleteError) {
      console.error('Failed to delete class:', deleteError)
      showToast(t('toastDeleteFailed', 'Échec de la suppression'), 'error')
    }
  }

  const filteredStudents = useMemo(() => {
    if (!data) return []
    const query = studentSearch.trim().toLowerCase()
    if (!query) return data.students
    return data.students.filter((student) => {
      const name = `${student.firstName} ${student.lastName}`.toLowerCase()
      return name.includes(query) || String(student.admissionNumber || '').toLowerCase().includes(query)
    })
  }, [data, studentSearch])

  const assignedSubjectIds = useMemo(() => {
    if (!data) return new Set<string>()
    return new Set(data.teachers.flatMap((teacher) => teacher.subjects.map((s) => s.id)))
  }, [data])

  const tabs = useMemo(
    () => [
      { key: 'students' as const, label: t('tabStudents', 'Élèves') },
      { key: 'teachers' as const, label: t('tabTeachers', 'Enseignants & matières') },
      { key: 'attendance' as const, label: t('tabAttendance', 'Présences') },
      { key: 'grades' as const, label: t('tabGrades', 'Notes') },
    ],
    [t]
  )

  const menuItems: ActionMenuItem[] = data
    ? [
        { id: 'edit', label: t('menuEdit', 'Modifier'), onClick: openEditClass },
        { id: 'add-teacher', label: t('menuAddTeacher', 'Ajouter un enseignant'), onClick: openAddTeacher },
        { id: 'add-students', label: t('menuAddStudents', 'Ajouter des élèves'), onClick: () => void openAddStudents() },
        {
          id: 'delete',
          label: t('menuDelete', 'Supprimer'),
          onClick: () => void handleDeleteClass(),
          tone: 'danger',
          separatorBefore: true,
        },
      ]
    : []

  if (status === 'loading' || !session) {
    return <div>{tCommon('loading', 'Chargement...')}</div>
  }

  const navItems = session.user.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS
  const titulaire = personName(data?.class.teacher)

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session.user.role === 'DEPUTY_ADMIN' ? 'Deputy Admin' : 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <DetailShell>
        <DetailBreadcrumb
          ariaLabel={t('breadcrumbAria', "Fil d'Ariane")}
          items={[
            { label: t('breadcrumbClasses', 'Classes'), href: '/admin/classes' },
            { label: data?.class.name || t('breadcrumbClasses', 'Classes') },
          ]}
        />

        {loading ? (
          <p className="text-sm ui-text-secondary">{t('loading', 'Chargement de la classe...')}</p>
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : data ? (
          <>
            <DetailHeader
              title={data.class.name}
              badges={
                data.class.grade ? <StatusPill tone="neutral">{data.class.grade}</StatusPill> : undefined
              }
              meta={
                <span>
                  {[
                    data.class.academicYearName || String(data.class.academicYear),
                    titulaire ? `${t('homeroom', 'Titulaire')} : ${titulaire}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              }
              actions={<ActionMenu label={t('moreActions', "Plus d'actions")} items={menuItems} />}
            />

            <KpiStrip
              items={[
                {
                  id: 'students',
                  label: t('kpiStudents', 'Élèves'),
                  value: String(data.summary.studentCount),
                },
                {
                  id: 'teachers',
                  label: t('kpiTeachers', 'Enseignants'),
                  value: String(data.summary.teacherCount),
                  hint: `${data.summary.subjectCount} ${t('subjectsShort', 'matières')}`,
                },
                {
                  id: 'attendance',
                  label: t('kpiAttendance', 'Présence'),
                  value:
                    data.summary.attendanceRate === null
                      ? '—'
                      : `${data.summary.attendanceRate.toFixed(0)} %`,
                },
                {
                  id: 'average',
                  label: t('kpiAverage', 'Moyenne'),
                  value:
                    data.summary.averageScore === null ? '—' : `${data.summary.averageScore.toFixed(1)} %`,
                },
              ]}
            />

            <DetailTabs tabs={tabs} active={activeTab} onChange={setTab} />

            {activeTab === 'students' ? (
              <div>
                <DetailToolbar title={t('roster', 'Liste des élèves')}>
                  <DetailSearchInput
                    value={studentSearch}
                    onChange={setStudentSearch}
                    placeholder={t('searchStudents', 'Rechercher un élève...')}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 shrink-0 inline-flex items-center gap-1.5"
                    onClick={() => void openAddStudents()}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t('addStudents', 'Ajouter')}
                  </Button>
                </DetailToolbar>
                {filteredStudents.length > 0 ? (
                  <div className="ui-table-wrap overflow-x-auto">
                    <table className="ui-table no-table-stripes min-w-full">
                      <thead>
                        <tr>
                          <th>{t('colStudent', 'Élève')}</th>
                          <th>{t('colAdmission', "N° d'admission")}</th>
                          <th>{t('colStatus', 'Statut')}</th>
                          <th>{t('colType', 'Type')}</th>
                          <th className="text-right">{t('colActions', 'Actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => (
                          <tr key={student.id}>
                            <td>
                              <Link
                                href={`/admin/students/${student.id}`}
                                className="font-medium text-[#635bff]"
                              >
                                {student.firstName} {student.lastName}
                              </Link>
                            </td>
                            <td>{student.admissionNumber || '—'}</td>
                            <td>
                              <StatusPill tone={student.status === 'LEFT' ? 'danger' : 'success'}>
                                {student.status === 'LEFT'
                                  ? t('statusLeft', 'Parti')
                                  : t('statusActive', 'Actif')}
                              </StatusPill>
                            </td>
                            <td className="ui-text-secondary">
                              {student.enrollmentType === 'additional'
                                ? t('enrollmentAdditional', 'Additionnel')
                                : t('enrollmentPrimary', 'Principal')}
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="text-sm font-medium text-[var(--danger)]"
                                onClick={() =>
                                  void handleRemoveStudent(
                                    student.id,
                                    student.enrollmentType,
                                    `${student.firstName} ${student.lastName}`
                                  )
                                }
                              >
                                {t('remove', 'Retirer')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm ui-text-secondary">{t('noStudents', 'Aucun élève dans cette classe.')}</p>
                )}
              </div>
            ) : null}

            {activeTab === 'teachers' ? (
              <div>
                <DetailToolbar title={t('tabTeachers', 'Enseignants & matières')}>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 shrink-0 inline-flex items-center gap-1.5"
                    onClick={openAddTeacher}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t('addTeacher', 'Ajouter un enseignant')}
                  </Button>
                </DetailToolbar>
                {data.teachers.length > 0 ? (
                  <div className="ui-table-wrap overflow-x-auto">
                    <table className="ui-table no-table-stripes min-w-full">
                      <thead>
                        <tr>
                          <th>{t('teacher', 'Enseignant')}</th>
                          <th>{t('colRole', 'Rôle')}</th>
                          <th>{t('colSubjects', 'Matières')}</th>
                          <th className="text-right">{t('colActions', 'Actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.teachers.map((group) => (
                          <tr key={group.teacherId}>
                            <td>
                              <p className="font-medium ui-text-primary">
                                {personName(group.teacher) || group.teacher.email}
                              </p>
                              <p className="text-xs ui-text-secondary">{group.teacher.email}</p>
                            </td>
                            <td>
                              {group.isHomeroom ? (
                                <StatusPill tone="neutral">{t('homeroomBadge', 'Titulaire')}</StatusPill>
                              ) : (
                                <span className="ui-text-secondary">—</span>
                              )}
                            </td>
                            <td>
                              {group.subjects.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {group.subjects.map((subject) => (
                                    <span
                                      key={subject.assignmentId}
                                      className="inline-flex items-center gap-1.5 rounded-[6px] border border-(--border-subtle) bg-(--surface-soft) px-2.5 py-1 text-[13px] ui-text-primary"
                                    >
                                      {subject.name}
                                      <button
                                        type="button"
                                        className="rounded px-1 text-[15px] leading-none font-medium text-[var(--danger)] hover:bg-(--surface)"
                                        aria-label={t('remove', 'Retirer')}
                                        onClick={(event) => {
                                          event.preventDefault()
                                          event.stopPropagation()
                                          void handleRemoveSubject({
                                            assignmentId: subject.assignmentId,
                                            subjectId: subject.id,
                                            subjectName: subject.name,
                                            teacherId: group.teacherId,
                                          })
                                        }}
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[13px] ui-text-secondary">
                                  {t('noSubjectsYet', 'Aucune matière assignée pour le moment.')}
                                </span>
                              )}
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="text-sm font-medium text-[#635bff]"
                                onClick={() => openAssignSubjects(group.teacherId)}
                              >
                                {t('assignSubjectsShort', 'Assigner →')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm ui-text-secondary">
                    {t('noTeachers', 'Aucun enseignant assigné à cette classe.')}
                  </p>
                )}
              </div>
            ) : null}

            {activeTab === 'attendance' ? (
              <div>
                <DetailToolbar title={t('recentAttendance', 'Présences récentes')} />
                {data.recentAttendance.length > 0 ? (
                  <div className="ui-table-wrap overflow-x-auto">
                    <table className="ui-table no-table-stripes min-w-full">
                      <thead>
                        <tr>
                          <th>{t('colStudent', 'Élève')}</th>
                          <th>{t('colDate', 'Date')}</th>
                          <th>{t('colStatus', 'Statut')}</th>
                          <th>{t('colNotes', 'Notes')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentAttendance.map((item) => (
                          <tr key={item.id}>
                            <td className="font-medium ui-text-primary">
                              {item.student.firstName} {item.student.lastName}
                            </td>
                            <td>{formatDate(item.date)}</td>
                            <td>
                              <StatusPill
                                tone={
                                  item.status === 'PRESENT'
                                    ? 'success'
                                    : item.status === 'LATE'
                                      ? 'pending'
                                      : 'danger'
                                }
                              >
                                {item.status === 'PRESENT'
                                  ? t('present', 'Présent')
                                  : item.status === 'LATE'
                                    ? t('late', 'En retard')
                                    : t('absent', 'Absent')}
                              </StatusPill>
                            </td>
                            <td className="ui-text-secondary">{item.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm ui-text-secondary">
                    {t('noAttendance', 'Aucun enregistrement de présence.')}
                  </p>
                )}
              </div>
            ) : null}

            {activeTab === 'grades' ? (
              <div>
                <DetailToolbar title={t('recentResults', 'Notes récentes')} />
                {data.results.length > 0 ? (
                  <div className="ui-table-wrap overflow-x-auto">
                    <table className="ui-table no-table-stripes min-w-full">
                      <thead>
                        <tr>
                          <th>{t('colStudent', 'Élève')}</th>
                          <th>{t('colSubject', 'Matière')}</th>
                          <th>{t('colTerm', 'Trimestre')}</th>
                          <th>{t('colScore', 'Note')}</th>
                          <th>{t('colGrade', 'Mention')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.results.map((result) => (
                          <tr key={result.id}>
                            <td>
                              {result.student.firstName} {result.student.lastName}
                            </td>
                            <td>{result.subject.name}</td>
                            <td>
                              {result.term} · {result.year}
                            </td>
                            <td className="font-semibold">
                              {typeof result.totalScore === 'number'
                                ? `${result.totalScore}/${result.maxScore}`
                                : '—'}
                            </td>
                            <td>{result.grade || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm ui-text-secondary">{t('noResults', 'Aucun résultat publié.')}</p>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </DetailShell>

      {showAddTeacher ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[10px] border border-(--border-subtle) bg-(--surface) p-5">
            <h2 className="text-[20px] font-semibold ui-text-primary">
              {t('addTeacherTitle', 'Ajouter un enseignant')}
            </h2>
            <form onSubmit={handleAddTeacher} className="mt-4 space-y-3">
              <Select
                label={t('teacher', 'Enseignant')}
                value={teacherForm.teacherId}
                onChange={(e) => setTeacherForm((prev) => ({ ...prev, teacherId: e.target.value }))}
                required
              >
                <option value="">{t('selectTeacher', 'Sélectionner un enseignant')}</option>
                {teachersList.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.firstName} {teacher.lastName}
                  </option>
                ))}
              </Select>
              <div>
                <DetailMetaLabel>{t('subjectsOptional', 'Matières (optionnel)')}</DetailMetaLabel>
                <p className="mb-2 mt-1 text-xs ui-text-secondary">
                  {t('assignLaterHint', 'Laissez vide pour assigner les matières plus tard.')}
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-[6px] border border-(--border-subtle) p-2">
                  {subjectsList.map((subject) => {
                    const checked = teacherForm.subjectIds.includes(subject.id)
                    const alreadyAssigned = assignedSubjectIds.has(subject.id)
                    return (
                      <label
                        key={subject.id}
                        className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm hover:bg-(--surface-soft)"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={alreadyAssigned && !checked}
                          onChange={(e) => {
                            setTeacherForm((prev) => ({
                              ...prev,
                              subjectIds: e.target.checked
                                ? [...prev.subjectIds, subject.id]
                                : prev.subjectIds.filter((id) => id !== subject.id),
                            }))
                          }}
                        />
                        <span className="ui-text-primary">
                          {subject.name}
                          {subject.code ? ` (${subject.code})` : ''}
                          {alreadyAssigned && !checked ? ` — ${t('alreadyAssigned', 'déjà assignée')}` : ''}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm ui-text-primary">
                <input
                  type="checkbox"
                  checked={teacherForm.setAsHomeroom}
                  onChange={(e) =>
                    setTeacherForm((prev) => ({ ...prev, setAsHomeroom: e.target.checked }))
                  }
                />
                {t('setAsHomeroom', 'Définir comme titulaire')}
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddTeacher(false)}>
                  {tCommon('cancel', 'Annuler')}
                </Button>
                <Button type="submit" isLoading={savingTeacher} className="inline-flex items-center gap-1.5">
                  <Save className="h-4 w-4" />
                  {tCommon('save', 'Enregistrer')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showAssignSubjects ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[10px] border border-(--border-subtle) bg-(--surface) p-5">
            <h2 className="text-[20px] font-semibold ui-text-primary">
              {t('assignSubjectsTitle', 'Assigner des matières')}
            </h2>
            <form onSubmit={handleAssignSubjects} className="mt-4 space-y-3">
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-[6px] border border-(--border-subtle) p-2">
                {subjectsList.map((subject) => {
                  const checked = assignSubjectIds.includes(subject.id)
                  const alreadyAssigned = assignedSubjectIds.has(subject.id)
                  return (
                    <label
                      key={subject.id}
                      className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm hover:bg-(--surface-soft)"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={alreadyAssigned && !checked}
                        onChange={(e) => {
                          setAssignSubjectIds((prev) =>
                            e.target.checked
                              ? [...prev, subject.id]
                              : prev.filter((id) => id !== subject.id)
                          )
                        }}
                      />
                      <span className="ui-text-primary">
                        {subject.name}
                        {alreadyAssigned && !checked ? ` — ${t('alreadyAssigned', 'déjà assignée')}` : ''}
                      </span>
                    </label>
                  )
                })}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAssignSubjects(false)}>
                  {tCommon('cancel', 'Annuler')}
                </Button>
                <Button type="submit" isLoading={savingTeacher} className="inline-flex items-center gap-1.5">
                  <Save className="h-4 w-4" />
                  {tCommon('save', 'Enregistrer')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showAddStudents ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-[10px] border border-(--border-subtle) bg-(--surface) p-5">
            <h2 className="text-[20px] font-semibold ui-text-primary">
              {t('addStudentsTitle', 'Ajouter des élèves')}
            </h2>
            <form onSubmit={handleAddStudents} className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
              {availableStudents.length > 0 ? (
                <>
                  <DetailSearchInput
                    value={availableStudentSearch}
                    onChange={setAvailableStudentSearch}
                    placeholder={t(
                      'searchAvailableStudents',
                      'Rechercher par nom, admission ou classe...'
                    )}
                    className="max-w-none w-full"
                  />
                  <p className="text-xs ui-text-secondary">
                    {filteredAvailableStudents.length} / {availableStudents.length}{' '}
                    {t('studentsShown', 'élèves')}
                    {selectedStudentIds.length > 0
                      ? ` · ${selectedStudentIds.length} ${t('selected', 'sélectionné(s)')}`
                      : ''}
                  </p>
                  <div className="max-h-72 min-h-40 space-y-1 overflow-y-auto rounded-[6px] border border-(--border-subtle) p-2">
                    {filteredAvailableStudents.length > 0 ? (
                      filteredAvailableStudents.map((student) => (
                        <label
                          key={student.id}
                          className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm hover:bg-(--surface-soft)"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.includes(student.id)}
                            onChange={(e) => {
                              setSelectedStudentIds((prev) =>
                                e.target.checked
                                  ? [...prev, student.id]
                                  : prev.filter((id) => id !== student.id)
                              )
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium ui-text-primary">
                              {student.firstName} {student.lastName}
                            </span>
                            <span className="block text-xs ui-text-secondary">
                              {[student.admissionNumber, student.class?.name].filter(Boolean).join(' · ') ||
                                '—'}
                            </span>
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className="px-2 py-4 text-center text-sm ui-text-secondary">
                        {t('noSearchMatches', 'Aucun élève ne correspond à la recherche.')}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm ui-text-secondary">
                  {t('noAvailableStudents', 'Aucun élève disponible à ajouter.')}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddStudents(false)}>
                  {tCommon('cancel', 'Annuler')}
                </Button>
                <Button
                  type="submit"
                  isLoading={addingStudents}
                  disabled={availableStudents.length === 0 || selectedStudentIds.length === 0}
                  className="inline-flex items-center gap-1.5"
                >
                  <UserPlus className="h-4 w-4" />
                  {tCommon('save', 'Enregistrer')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editClassOpen && data ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <div className="w-full max-w-md rounded-[10px] border border-(--border-subtle) bg-(--surface) p-5">
            <h2 className="text-[20px] font-semibold ui-text-primary">{t('editTitle', 'Modifier la classe')}</h2>
            <form onSubmit={handleSaveClass} className="mt-4 space-y-3">
              <Input
                label={t('className', 'Nom')}
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
              <Select
                label={t('homeroom', 'Titulaire')}
                value={editForm.teacherId}
                onChange={(e) => setEditForm((prev) => ({ ...prev, teacherId: e.target.value }))}
              >
                <option value="">{t('assignLater', 'Assigner plus tard')}</option>
                {teachersList.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.firstName} {teacher.lastName}
                  </option>
                ))}
              </Select>
              <Input
                label={t('capacity', 'Capacité')}
                type="number"
                value={editForm.capacity}
                onChange={(e) => setEditForm((prev) => ({ ...prev, capacity: e.target.value }))}
                min={1}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setEditClassOpen(false)}>
                  {tCommon('cancel', 'Annuler')}
                </Button>
                <Button type="submit" isLoading={savingEdit} className="inline-flex items-center gap-1.5">
                  <Save className="h-4 w-4" />
                  {tCommon('save', 'Enregistrer')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  )
}
