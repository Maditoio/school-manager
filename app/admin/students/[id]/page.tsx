'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import {
  ActionMenu,
  DetailBreadcrumb,
  DetailCard,
  DetailHeader,
  DetailMetaLabel,
  DetailShell,
  DetailTabs,
  KpiStrip,
  StatusPill,
  type ActionMenuItem,
} from '@/components/admin/detail'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import { useCurrency } from '@/lib/currency-context'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'

type LeaveReason = 'SUSPENSION' | 'GRADUATION' | 'TRANSFERRED_SCHOOL' | 'OTHER'
type StudentStatus = 'ACTIVE' | 'LEFT'
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE'
type TabKey = 'overview' | 'attendance' | 'academics' | 'history'

interface StudentOverviewResponse {
  student: {
    id: string
    firstName: string
    lastName: string
    status: StudentStatus
    statusReason: LeaveReason | null
    statusDate: string | null
    statusNotes: string | null
    admissionNumber: string | null
    gender: 'MALE' | 'FEMALE' | null
    dateOfBirth: string | null
    parentName: string | null
    parentEmail: string | null
    parentPhone: string | null
    emergencyContactName: string | null
    emergencyContactPhone: string | null
    academicYear: number
    classId: string
    parentId: string | null
    userId: string | null
    hasLogin: boolean
    class: {
      id: string
      name: string
      grade: string | null
    }
    parent: {
      id: string
      firstName: string | null
      lastName: string | null
      email: string
    } | null
  }
  attendanceSummary: {
    present: number
    absent: number
    late: number
  }
  recentAttendance: Array<{
    id: string
    date: string
    status: AttendanceStatus
    notes: string | null
  }>
  subjects: Array<{
    id: string
    name: string
    code: string | null
    teacherName: string
  }>
  results: Array<{
    id: string
    term: string
    year: number
    totalScore: number | null
    maxScore: number
    grade: string | null
    subject: {
      id: string
      name: string
      code: string | null
    }
  }>
  assessmentSummary: {
    gradedCount: number
    averageScore: number | null
  }
  feeSummary: {
    outstanding: number
    openInvoiceCount: number
  }
  classHistory: Array<{
    id: string
    effectiveAt: string
    reason: string | null
    fromClass: {
      id: string
      name: string
      grade: string | null
      academicYear: number
    } | null
    toClass: {
      id: string
      name: string
      grade: string | null
      academicYear: number
    }
    changedBy: {
      id: string
      firstName: string | null
      lastName: string | null
      email: string
    } | null
  }>
  statusHistory: Array<{
    id: string
    status: StudentStatus
    reason: LeaveReason | null
    effectiveAt: string
    notes: string | null
    changedBy: {
      id: string
      firstName: string | null
      lastName: string | null
      email: string
    } | null
  }>
}

interface ClassOption {
  id: string
  name: string
}

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template
  )
}

function personName(
  person: { firstName: string | null; lastName: string | null; email?: string } | null | undefined
) {
  if (!person) return null
  const name = `${person.firstName || ''} ${person.lastName || ''}`.trim()
  return name || person.email || null
}

export default function StudentDetailsPage() {
  const params = useParams<{ id: string }>()
  const studentId = params?.id
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { formatCurrency } = useCurrency()

  const preferredLanguage = session?.user?.preferredLanguage || 'fr'
  const dateLocale = preferredLanguage === 'sw' ? 'sw-TZ' : preferredLanguage === 'en' ? 'en-GB' : 'fr-FR'

  const detailMessages = useMemo(() => {
    const currentMessages =
      preferredLanguage === 'fr' ? frMessages : preferredLanguage === 'sw' ? swMessages : enMessages
    return (currentMessages as Record<string, unknown>).studentsDetail as Record<string, string> | undefined
  }, [preferredLanguage])

  const t = useCallback(
    (key: string, fallback: string) => detailMessages?.[key] || fallback,
    [detailMessages]
  )

  const formatDate = useCallback(
    (value: string | null | undefined) => {
      if (!value) return '—'
      return new Date(value).toLocaleDateString(dateLocale)
    },
    [dateLocale]
  )

  const leaveReasonLabels = useMemo(
    () =>
      ({
        SUSPENSION: t('reasonSuspension', 'Suspension'),
        GRADUATION: t('reasonGraduation', 'Diplôme'),
        TRANSFERRED_SCHOOL: t('reasonTransfer', "Changement d'école"),
        OTHER: t('reasonOther', 'Autre'),
      }) satisfies Record<LeaveReason, string>,
    [t]
  )

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<StudentOverviewResponse | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginCredentials, setLoginCredentials] = useState<{
    username: string
    temporaryPassword: string
  } | null>(null)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    gender: '' as '' | 'MALE' | 'FEMALE',
    dateOfBirth: '',
    admissionNumber: '',
    classId: '',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  })
  const [statusForm, setStatusForm] = useState({
    status: 'LEFT' as StudentStatus,
    reason: 'SUSPENSION' as LeaveReason,
    effectiveAt: new Date().toISOString().split('T')[0],
    notes: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role !== 'SCHOOL_ADMIN' && session?.user?.role !== 'DEPUTY_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  const loadOverview = useCallback(async () => {
    if (!studentId || !session?.user) return
    try {
      setLoading(true)
      setError('')
      const res = await fetch(`/api/students/${studentId}/overview`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || t('loadError', "Échec du chargement de l'aperçu de l'étudiant"))
        setData(null)
        return
      }
      setData((await res.json()) as StudentOverviewResponse)
    } catch (loadError) {
      console.error('Failed to load student overview:', loadError)
      setError(t('loadError', "Échec du chargement de l'aperçu de l'étudiant"))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [session?.user, studentId, t])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    if (!session?.user) return
    const loadClasses = async () => {
      try {
        const res = await fetch('/api/classes')
        if (!res.ok) return
        const payload = await res.json()
        const list = Array.isArray(payload) ? payload : payload.classes || []
        setClasses(list.map((item: { id: string; name: string }) => ({ id: item.id, name: item.name })))
      } catch (classesError) {
        console.error('Failed to load classes:', classesError)
      }
    }
    loadClasses()
  }, [session?.user])

  const openEditModal = () => {
    if (!data) return
    const student = data.student
    setEditForm({
      firstName: student.firstName,
      lastName: student.lastName,
      gender: student.gender || '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '',
      admissionNumber: student.admissionNumber || '',
      classId: student.classId || student.class.id,
      parentName: student.parentName || '',
      parentEmail: student.parentEmail || '',
      parentPhone: student.parentPhone || '',
      emergencyContactName: student.emergencyContactName || '',
      emergencyContactPhone: student.emergencyContactPhone || '',
    })
    setShowEditModal(true)
  }

  const openStatusModal = () => {
    if (!data) return
    const student = data.student
    setStatusForm({
      status: student.status,
      reason: student.statusReason || 'SUSPENSION',
      effectiveAt: student.statusDate
        ? student.statusDate.split('T')[0]
        : new Date().toISOString().split('T')[0],
      notes: student.statusNotes || '',
    })
    setShowStatusModal(true)
  }

  const handleSaveEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!studentId) return
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.classId) {
      showToast(t('toastRequiredFields', 'Le prénom, le nom et la classe sont requis'), 'error')
      return
    }
    if (!editForm.gender) {
      showToast(t('toastGenderRequired', 'Le genre est requis'), 'error')
      return
    }

    setSavingEdit(true)
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          gender: editForm.gender,
          dateOfBirth: editForm.dateOfBirth || undefined,
          admissionNumber: editForm.admissionNumber.trim() || undefined,
          classId: editForm.classId,
          parentName: editForm.parentName.trim() || undefined,
          parentEmail: editForm.parentEmail.trim() || undefined,
          parentPhone: editForm.parentPhone.trim() || undefined,
          emergencyContactName: editForm.emergencyContactName.trim() || undefined,
          emergencyContactPhone: editForm.emergencyContactPhone.trim() || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message =
          typeof body.error === 'string'
            ? body.error
            : Array.isArray(body.error)
              ? t('toastValidationFailed', 'Échec de la validation')
              : t('toastUpdateFailed', "Échec de la mise à jour de l'étudiant")
        showToast(message, 'error')
        return
      }
      showToast(t('toastUpdated', 'Étudiant mis à jour'), 'success')
      setShowEditModal(false)
      await loadOverview()
    } catch (saveError) {
      console.error('Failed to update student:', saveError)
      showToast(t('toastUpdateFailed', "Échec de la mise à jour de l'étudiant"), 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleSaveStatus = async (event: FormEvent) => {
    event.preventDefault()
    if (!studentId) return
    if (statusForm.status === 'LEFT' && !statusForm.reason) {
      showToast(t('toastSelectReason', 'Sélectionnez une raison de départ'), 'error')
      return
    }

    setSavingStatus(true)
    try {
      const res = await fetch(`/api/students/${studentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: statusForm.status,
          reason: statusForm.status === 'LEFT' ? statusForm.reason : undefined,
          effectiveAt: statusForm.effectiveAt,
          notes: statusForm.notes.trim() || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(body.error || t('toastStatusFailed', 'Échec de la mise à jour du statut'), 'error')
        return
      }
      showToast(t('toastStatusUpdated', 'Statut mis à jour'), 'success')
      setShowStatusModal(false)
      await loadOverview()
    } catch (statusError) {
      console.error('Failed to update status:', statusError)
      showToast(t('toastStatusFailed', 'Échec de la mise à jour du statut'), 'error')
    } finally {
      setSavingStatus(false)
    }
  }

  const handleCreateLogin = async () => {
    if (!studentId) return
    setLoginBusy(true)
    try {
      const res = await fetch(`/api/students/${studentId}/create-login`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(body.error || t('toastCreateLoginFailed', 'Échec de la création de la connexion'), 'error')
        return
      }
      setLoginCredentials({
        username: body.username,
        temporaryPassword: body.temporaryPassword,
      })
      await loadOverview()
    } catch (loginError) {
      console.error('Failed to create student login:', loginError)
      showToast(t('toastCreateLoginFailed', 'Échec de la création de la connexion'), 'error')
    } finally {
      setLoginBusy(false)
    }
  }

  const handleRemoveLogin = async () => {
    if (!studentId || !data) return
    const name = `${data.student.firstName} ${data.student.lastName}`
    if (
      !confirm(
        interpolate(t('toastRemoveLoginConfirm', 'Supprimer la connexion de {name} ? Il ne pourra plus se connecter.'), {
          name,
        })
      )
    ) {
      return
    }
    setLoginBusy(true)
    try {
      const res = await fetch(`/api/students/${studentId}/create-login`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(body.error || t('toastRemoveLoginFailed', 'Échec de la suppression de la connexion'), 'error')
        return
      }
      showToast(t('toastRemoveLoginSuccess', "Connexion de l'étudiant supprimée"), 'success')
      await loadOverview()
    } catch (loginError) {
      console.error('Failed to remove student login:', loginError)
      showToast(t('toastRemoveLoginFailed', 'Échec de la suppression de la connexion'), 'error')
    } finally {
      setLoginBusy(false)
    }
  }

  const handleResetParentPassword = async () => {
    if (!data) return
    const parentId = data.student.parentId || data.student.parent?.id
    if (!parentId) {
      showToast(t('toastNoParent', 'Aucun compte parent lié pour cet étudiant'), 'warning')
      return
    }
    const name = `${data.student.firstName} ${data.student.lastName}`
    const newPassword = prompt(
      interpolate(
        t('toastPasswordPrompt', 'Entrez un mot de passe temporaire pour le parent de {name} (min. 6 caractères) :'),
        { name }
      )
    )
    if (!newPassword) return
    if (newPassword.length < 6) {
      showToast(t('toastPasswordMin', 'Le mot de passe doit contenir au moins 6 caractères'), 'error')
      return
    }
    try {
      const res = await fetch(`/api/users/${parentId}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(
          body.error || t('toastResetParentFailed', 'Échec de la réinitialisation du mot de passe parent'),
          'error'
        )
        return
      }
      showToast(
        t(
          'toastResetParentSuccess',
          'Mot de passe parent réinitialisé. Le parent doit le modifier à la première connexion.'
        ),
        'success'
      )
    } catch (resetError) {
      console.error('Failed to reset parent password:', resetError)
      showToast(t('toastResetParentFailed', 'Échec de la réinitialisation du mot de passe parent'), 'error')
    }
  }

  const attendanceRate = useMemo(() => {
    if (!data) return null
    const { present, absent, late } = data.attendanceSummary
    const total = present + absent + late
    if (total === 0) return null
    return ((present + late) / total) * 100
  }, [data])

  const resultsBySubject = useMemo(() => {
    if (!data) return []
    const map = new Map<
      string,
      {
        subjectId: string
        subjectName: string
        subjectCode: string | null
        rows: StudentOverviewResponse['results']
      }
    >()
    for (const result of data.results) {
      const existing = map.get(result.subject.id)
      if (existing) existing.rows.push(result)
      else {
        map.set(result.subject.id, {
          subjectId: result.subject.id,
          subjectName: result.subject.name,
          subjectCode: result.subject.code,
          rows: [result],
        })
      }
    }
    return Array.from(map.values())
  }, [data])

  const historyTimeline = useMemo(() => {
    if (!data) return []
    const classEvents = data.classHistory.map((entry) => ({
      id: `class-${entry.id}`,
      at: entry.effectiveAt,
      kind: 'class' as const,
      title: interpolate(t('movedTo', 'Transféré vers {name}'), { name: entry.toClass.name }),
      detail: entry.fromClass
        ? `${interpolate(t('fromClass', 'Depuis {name}'), { name: entry.fromClass.name })}${
            entry.reason ? ` · ${entry.reason}` : ''
          }`
        : entry.reason || t('initialAssignment', 'Affectation initiale'),
      actor: personName(entry.changedBy) || t('system', 'Système'),
    }))
    const statusEvents = data.statusHistory.map((entry) => ({
      id: `status-${entry.id}`,
      at: entry.effectiveAt,
      kind: 'status' as const,
      title:
        entry.status === 'LEFT'
          ? t('leftSchool', "A quitté l'école")
          : t('markedActive', 'Marqué actif'),
      detail:
        [entry.reason ? leaveReasonLabels[entry.reason] : null, entry.notes]
          .filter(Boolean)
          .join(' · ') || t('statusChange', 'Changement de statut'),
      actor: personName(entry.changedBy) || t('system', 'Système'),
    }))
    return [...classEvents, ...statusEvents].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    )
  }, [data, leaveReasonLabels, t])

  const tabs = useMemo(
    () => [
      { key: 'overview' as const, label: t('tabOverview', 'Aperçu') },
      { key: 'attendance' as const, label: t('tabAttendance', 'Présence') },
      { key: 'academics' as const, label: t('tabAcademics', 'Scolarité') },
      { key: 'history' as const, label: t('tabHistory', 'Historique') },
    ],
    [t]
  )

  const navItems = session?.user?.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS
  const hasLogin = Boolean(data?.student.hasLogin || data?.student.userId)
  const parentDisplayName = data?.student.parentName || personName(data?.student.parent) || null
  const parentEmail = data?.student.parentEmail || data?.student.parent?.email || null
  const parentPhone = data?.student.parentPhone || null
  const feeOutstanding = data?.feeSummary?.outstanding ?? 0
  const openInvoices = data?.feeSummary?.openInvoiceCount ?? 0

  const menuItems: ActionMenuItem[] = data
    ? [
        {
          id: 'edit',
          label: t('menuEdit', 'Modifier'),
          onClick: openEditModal,
        },
        {
          id: 'status',
          label: t('menuUpdateStatus', 'Mettre à jour le statut'),
          onClick: openStatusModal,
        },
        {
          id: 'login',
          label: hasLogin
            ? t('menuRemoveLogin', 'Supprimer la connexion')
            : t('menuCreateLogin', 'Créer la connexion'),
          onClick: hasLogin ? handleRemoveLogin : handleCreateLogin,
          disabled: loginBusy,
          tone: hasLogin ? 'danger' : 'default',
          separatorBefore: true,
        },
        {
          id: 'parent-password',
          label: t('menuResetParentPassword', 'Réinitialiser le mot de passe parent'),
          onClick: handleResetParentPassword,
        },
        {
          id: 'message',
          label: t('menuMessageParent', 'Contacter le parent'),
          onClick: () => {
            window.location.href = '/admin/messages'
          },
        },
      ]
    : []

  if (status === 'loading' || !session) {
    return <div>{t('loading', 'Chargement...')}</div>
  }

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session?.user?.role === 'DEPUTY_ADMIN' ? 'Deputy Admin' : 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <DetailShell>
        <DetailBreadcrumb
          ariaLabel={t('breadcrumbAria', "Fil d'Ariane")}
          items={[
            { label: t('breadcrumbStudents', 'Étudiants'), href: '/admin/students' },
            {
              label: data
                ? `${data.student.firstName} ${data.student.lastName}`
                : t('breadcrumbStudents', 'Étudiants'),
            },
          ]}
        />

        {loading ? (
          <DetailCard>
            <p className="text-sm ui-text-secondary">
              {t('loadingDetails', "Chargement des détails de l'étudiant...")}
            </p>
          </DetailCard>
        ) : error ? (
          <DetailCard>
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </DetailCard>
        ) : data ? (
          <>
            <DetailHeader
              title={`${data.student.firstName} ${data.student.lastName}`}
              badges={
                <StatusPill tone={data.student.status === 'LEFT' ? 'danger' : 'success'}>
                  {data.student.status === 'LEFT' ? t('left', 'Parti') : t('active', 'Actif')}
                </StatusPill>
              }
              meta={
                <span>
                  {[data.student.class.name, data.student.admissionNumber].filter(Boolean).join(' · ')}
                </span>
              }
              subtitle={
                data.student.status === 'LEFT' && data.student.statusReason
                  ? `${leaveReasonLabels[data.student.statusReason]}${
                      data.student.statusDate ? ` · ${formatDate(data.student.statusDate)}` : ''
                    }`
                  : undefined
              }
              actions={<ActionMenu label={t('moreActions', "Plus d'actions")} items={menuItems} />}
            />

            <KpiStrip
              items={[
                {
                  id: 'attendance',
                  label: t('kpiAttendance', 'Présence'),
                  value: attendanceRate === null ? '—' : `${attendanceRate.toFixed(0)} %`,
                },
                {
                  id: 'average',
                  label: t('kpiAverage', 'Moyenne'),
                  value:
                    typeof data.assessmentSummary.averageScore === 'number'
                      ? data.assessmentSummary.averageScore.toFixed(1)
                      : '—',
                },
                {
                  id: 'fees',
                  label: t('kpiOutstanding', 'Impayés'),
                  value: formatCurrency(feeOutstanding),
                  hint:
                    openInvoices > 0
                      ? interpolate(t('kpiOpenCount', '{count} ouvert(s)'), { count: openInvoices })
                      : t('kpiSettled', 'À jour'),
                },
              ]}
            />

            <DetailTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

            {activeTab === 'overview' ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DetailCard>
                  <DetailMetaLabel>{t('contacts', 'Contacts')}</DetailMetaLabel>
                  <div className="mt-3 space-y-3 text-sm">
                    <div>
                      <p className="font-medium ui-text-primary">
                        {parentDisplayName || t('noParent', 'Aucun parent renseigné')}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-3">
                        {parentEmail ? (
                          <a href={`mailto:${parentEmail}`} className="font-medium text-[#635bff]">
                            {parentEmail}
                          </a>
                        ) : null}
                        {parentPhone ? (
                          <a href={`tel:${parentPhone}`} className="font-medium text-[#635bff]">
                            {parentPhone}
                          </a>
                        ) : null}
                        {!parentEmail && !parentPhone ? (
                          <span className="ui-text-secondary">
                            {t('noContactDetails', 'Aucune coordonnée')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {(data.student.emergencyContactName || data.student.emergencyContactPhone) && (
                      <div className="border-t border-(--border-subtle) pt-3">
                        <DetailMetaLabel>{t('emergency', 'Urgence')}</DetailMetaLabel>
                        <p className="mt-1 ui-text-primary">
                          {data.student.emergencyContactName || '—'}
                        </p>
                        {data.student.emergencyContactPhone ? (
                          <a
                            href={`tel:${data.student.emergencyContactPhone}`}
                            className="mt-1 inline-block font-medium text-[#635bff]"
                          >
                            {data.student.emergencyContactPhone}
                          </a>
                        ) : null}
                      </div>
                    )}
                    {(data.student.gender || data.student.dateOfBirth) && (
                      <div className="border-t border-(--border-subtle) pt-3 text-xs ui-text-secondary">
                        {[
                          data.student.gender === 'MALE'
                            ? t('male', 'Masculin')
                            : data.student.gender === 'FEMALE'
                              ? t('female', 'Féminin')
                              : null,
                          data.student.dateOfBirth
                            ? interpolate(t('born', 'Né(e) le {date}'), {
                                date: formatDate(data.student.dateOfBirth),
                              })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                </DetailCard>

                <DetailCard>
                  <div className="flex items-center justify-between gap-2">
                    <DetailMetaLabel>{t('subjects', 'Matières')}</DetailMetaLabel>
                    <span className="text-xs ui-text-secondary">{data.subjects.length}</span>
                  </div>
                  {data.subjects.length > 0 ? (
                    <ul className="mt-3 divide-y divide-(--border-subtle)">
                      {data.subjects.map((subject) => (
                        <li key={subject.id} className="flex items-start justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium ui-text-primary">{subject.name}</p>
                            <p className="text-xs ui-text-secondary">
                              {subject.code || t('noCode', 'Sans code')}
                            </p>
                          </div>
                          <p className="shrink-0 text-xs ui-text-secondary">{subject.teacherName}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm ui-text-secondary">
                      {t('noSubjects', 'Aucune matière assignée.')}
                    </p>
                  )}
                </DetailCard>
              </div>
            ) : null}

            {activeTab === 'attendance' ? (
              <DetailCard>
                <DetailMetaLabel>{t('recentRecords', 'Enregistrements récents')}</DetailMetaLabel>
                {data.recentAttendance.length > 0 ? (
                  <ul className="mt-3 divide-y divide-(--border-subtle)">
                    {data.recentAttendance.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium ui-text-primary">{formatDate(item.date)}</p>
                          {item.notes ? (
                            <p className="mt-0.5 text-xs ui-text-secondary">{item.notes}</p>
                          ) : null}
                        </div>
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
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm ui-text-secondary">
                    {t('noAttendance', 'Aucun enregistrement de présence.')}
                  </p>
                )}
              </DetailCard>
            ) : null}

            {activeTab === 'academics' ? (
              <div className="space-y-3">
                {resultsBySubject.length > 0 ? (
                  resultsBySubject.map((group) => (
                    <DetailCard key={group.subjectId}>
                      <div className="mb-3">
                        <p className="text-sm font-semibold ui-text-primary">{group.subjectName}</p>
                        {group.subjectCode ? (
                          <p className="text-xs ui-text-secondary">{group.subjectCode}</p>
                        ) : null}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="ui-table no-table-stripes min-w-full">
                          <thead>
                            <tr>
                              <th>{t('term', 'Trimestre')}</th>
                              <th>{t('year', 'Année')}</th>
                              <th>{t('score', 'Note')}</th>
                              <th>{t('grade', 'Mention')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((result) => (
                              <tr key={result.id}>
                                <td>{result.term}</td>
                                <td>{result.year}</td>
                                <td className="font-semibold">
                                  {typeof result.totalScore === 'number'
                                    ? `${result.totalScore}/${result.maxScore}`
                                    : '—'}
                                </td>
                                <td>
                                  {result.grade ? (
                                    <StatusPill tone="neutral">{result.grade}</StatusPill>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </DetailCard>
                  ))
                ) : (
                  <DetailCard>
                    <p className="text-sm ui-text-secondary">
                      {t('noResults', 'Aucun résultat publié pour cet étudiant.')}
                    </p>
                  </DetailCard>
                )}
              </div>
            ) : null}

            {activeTab === 'history' ? (
              <DetailCard>
                <DetailMetaLabel>{t('timeline', 'Chronologie')}</DetailMetaLabel>
                {historyTimeline.length > 0 ? (
                  <ul className="mt-3">
                    {historyTimeline.map((event) => (
                      <li
                        key={event.id}
                        className="relative border-l border-(--border-subtle) pb-4 pl-4 last:pb-0"
                      >
                        <span
                          className={`absolute -left-[3.5px] top-1.5 h-1.5 w-1.5 rounded-full ${
                            event.kind === 'status' ? 'bg-[var(--danger)]' : 'bg-[#635bff]'
                          }`}
                        />
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium ui-text-primary">{event.title}</p>
                            <p className="mt-0.5 text-xs ui-text-secondary">{event.detail}</p>
                            <p className="mt-1 text-xs ui-text-secondary">
                              {interpolate(t('byActor', 'Par {name}'), { name: event.actor })}
                            </p>
                          </div>
                          <p className="text-xs ui-text-secondary">{formatDate(event.at)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm ui-text-secondary">
                    {t('noHistory', 'Aucun historique pour le moment.')}
                  </p>
                )}
              </DetailCard>
            ) : null}
          </>
        ) : null}
      </DetailShell>

      {showEditModal && data ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[10px] border border-(--border-subtle) bg-(--surface) p-5">
            <h2 className="text-[1.25rem] font-semibold ui-text-primary">
              {t('editTitle', "Modifier l'étudiant")}
            </h2>
            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label={t('firstName', 'Prénom')}
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  required
                />
                <Input
                  label={t('lastName', 'Nom')}
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </div>
              <Select
                label={t('gender', 'Genre')}
                value={editForm.gender}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    gender: e.target.value as '' | 'MALE' | 'FEMALE',
                  }))
                }
                required
              >
                <option value="">{t('selectGender', 'Sélectionner le genre')}</option>
                <option value="MALE">{t('male', 'Masculin')}</option>
                <option value="FEMALE">{t('female', 'Féminin')}</option>
              </Select>
              <Input
                label={t('dateOfBirth', 'Date de naissance')}
                type="date"
                value={editForm.dateOfBirth}
                onChange={(e) => setEditForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
              />
              <Input
                label={t('admissionNumber', "Numéro d'admission")}
                value={editForm.admissionNumber}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, admissionNumber: e.target.value }))
                }
              />
              <Select
                label={t('class', 'Classe')}
                value={editForm.classId}
                onChange={(e) => setEditForm((prev) => ({ ...prev, classId: e.target.value }))}
                required
              >
                <option value="">{t('selectClass', 'Sélectionner une classe')}</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <Input
                label={t('parentName', 'Nom du parent')}
                value={editForm.parentName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, parentName: e.target.value }))}
              />
              <Input
                label={t('parentEmail', 'Email du parent')}
                type="email"
                value={editForm.parentEmail}
                onChange={(e) => setEditForm((prev) => ({ ...prev, parentEmail: e.target.value }))}
              />
              <Input
                label={t('parentPhone', 'Téléphone du parent')}
                value={editForm.parentPhone}
                onChange={(e) => setEditForm((prev) => ({ ...prev, parentPhone: e.target.value }))}
              />
              <Input
                label={t('emergencyName', "Nom du contact d'urgence")}
                value={editForm.emergencyContactName}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, emergencyContactName: e.target.value }))
                }
              />
              <Input
                label={t('emergencyPhone', "Téléphone du contact d'urgence")}
                value={editForm.emergencyContactPhone}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, emergencyContactPhone: e.target.value }))
                }
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>
                  {t('cancel', 'Annuler')}
                </Button>
                <Button type="submit" isLoading={savingEdit}>
                  {t('saveChanges', 'Enregistrer')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showStatusModal && data ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <div className="w-full max-w-md rounded-[10px] border border-(--border-subtle) bg-(--surface) p-5">
            <h2 className="text-[1.25rem] font-semibold ui-text-primary">
              {t('statusTitle', 'Mettre à jour le statut')}
            </h2>
            <form onSubmit={handleSaveStatus} className="mt-4 space-y-3">
              <Select
                label={t('status', 'Statut')}
                value={statusForm.status}
                onChange={(e) =>
                  setStatusForm((prev) => ({
                    ...prev,
                    status: e.target.value as StudentStatus,
                  }))
                }
              >
                <option value="ACTIVE">{t('statusActive', 'Actif')}</option>
                <option value="LEFT">{t('statusLeft', "A quitté l'école")}</option>
              </Select>
              {statusForm.status === 'LEFT' ? (
                <Select
                  label={t('reason', 'Raison')}
                  value={statusForm.reason}
                  onChange={(e) =>
                    setStatusForm((prev) => ({
                      ...prev,
                      reason: e.target.value as LeaveReason,
                    }))
                  }
                >
                  <option value="SUSPENSION">{t('reasonSuspension', 'Suspension')}</option>
                  <option value="GRADUATION">{t('reasonGraduation', 'Diplôme')}</option>
                  <option value="TRANSFERRED_SCHOOL">
                    {t('reasonTransfer', "Changement d'école")}
                  </option>
                  <option value="OTHER">{t('reasonOther', 'Autre')}</option>
                </Select>
              ) : null}
              <Input
                label={t('effectiveDate', "Date d'effet")}
                type="date"
                value={statusForm.effectiveAt}
                onChange={(e) =>
                  setStatusForm((prev) => ({ ...prev, effectiveAt: e.target.value }))
                }
                required
              />
              <Input
                label={t('notes', 'Notes')}
                value={statusForm.notes}
                onChange={(e) => setStatusForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowStatusModal(false)}>
                  {t('cancel', 'Annuler')}
                </Button>
                <Button type="submit" isLoading={savingStatus}>
                  {t('saveStatus', 'Enregistrer le statut')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {loginCredentials ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <div className="w-full max-w-md rounded-[10px] border border-(--border-subtle) bg-(--surface) p-5">
            <h2 className="text-[1.25rem] font-semibold ui-text-primary">
              {t('loginCreatedTitle', 'Connexion créée')}
            </h2>
            <p className="mt-1 text-sm ui-text-secondary">
              {t(
                'loginCreatedHint',
                "Partagez ces identifiants en toute sécurité. L'étudiant devra changer le mot de passe à la première connexion."
              )}
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <DetailMetaLabel>{t('username', "Nom d'utilisateur")}</DetailMetaLabel>
                <p className="mt-1 font-semibold ui-text-primary">{loginCredentials.username}</p>
              </div>
              <div>
                <DetailMetaLabel>{t('temporaryPassword', 'Mot de passe temporaire')}</DetailMetaLabel>
                <p className="mt-1 font-semibold ui-text-primary">
                  {loginCredentials.temporaryPassword}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" onClick={() => setLoginCredentials(null)}>
                {t('done', 'Terminé')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  )
}
