'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'

interface StudentAssessmentResult {
  id: string
  score: number | null
  graded: boolean
  feedback: string | null
  assessment: {
    id: string
    title: string
    type: string
    totalMarks: number
    dueDate: string | null
    createdAt: string
    subject: {
      id: string
      name: string
      code: string | null
    }
  }
}

interface MeResponse {
  student: {
    id: string
    firstName: string
    lastName: string
    admissionNumber: string | null
    dateOfBirth: string | null
    gender: string | null
    status: string
    academicYear: number
    class: {
      id: string
      name: string
      grade: string | null
      subjectAssignments: Array<{
        subject: { id: string; name: string; code: string | null }
      }>
    } | null
    parent: {
      id: string
      firstName: string
      lastName: string
      email: string
    } | null
    attendance: Array<{ status: string; date: string }>
    studentAssessments: StudentAssessmentResult[]
    attendanceSummary: {
      total: number
      present: number
      absent: number
      rate: number
    }
  }
}

const typeColors: Record<string, string> = {
  QUIZ: 'bg-purple-100 text-purple-700',
  TEST: 'bg-blue-100 text-blue-700',
  EXAM: 'bg-red-100 text-red-700',
  ASSIGNMENT: 'bg-amber-100 text-amber-700',
}

const typeLabels: Record<string, string> = {
  QUIZ: 'Quiz',
  TEST: 'Test',
  EXAM: 'Examen',
  ASSIGNMENT: 'Devoir',
}

const filterButtonLabels: Record<string, string> = {
  ALL: 'Tout',
  EXAM: 'Examen',
  TEST: 'Test',
  QUIZ: 'Quiz',
  ASSIGNMENT: 'Devoir',
}

const genderLabels: Record<string, string> = {
  MALE: 'Masculin',
  FEMALE: 'Féminin',
  OTHER: 'Autre',
}

const statusBadgeLabels: Record<string, string> = {
  ACTIVE: 'ACTIF',
  INACTIVE: 'INACTIF',
  SUSPENDED: 'SUSPENDU',
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider ui-text-secondary mb-0.5">{label}</p>
      <p className="text-sm font-medium ui-text-primary">{value || 'N/A'}</p>
    </div>
  )
}

export default function StudentDashboardPage() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<MeResponse | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('ALL')

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'STUDENT') redirect('/login')
  }, [session, status])

  useEffect(() => {
    const load = async () => {
      if (!session?.user) return
      try {
        setLoading(true)
        setError('')
        const res = await fetch('/api/student/me')
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error || 'Échec du chargement du profil')
          return
        }
        setData(await res.json())
      } catch {
        setError('Échec du chargement du profil')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session])

  if (status === 'loading' || !session) return null

  const s = data?.student
  const initials = s ? `${s.firstName[0]}${s.lastName[0]}`.toUpperCase() : '??'
  const results: StudentAssessmentResult[] = s?.studentAssessments ?? []
  const filteredResults = typeFilter === 'ALL' ? results : results.filter(r => r.assessment.type === typeFilter)
  const gradedResults = results.filter(r => r.graded && r.score !== null)
  const avgScore = gradedResults.length > 0
    ? Math.round(gradedResults.reduce((sum, r) => sum + (r.score! / r.assessment.totalMarks) * 100, 0) / gradedResults.length)
    : null

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Étudiant',
        role: 'Étudiant',
        email: session.user.email,
      }}
      navItems={STUDENT_NAV_ITEMS}
    >
      <div className="space-y-4">
        <h1 className="text-lg font-semibold ui-text-primary">Mon Profil</h1>

        {loading ? (
          <div className="ui-surface p-6 flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent)" />
            <p className="text-sm ui-text-secondary">Chargement du profil...</p>
          </div>
        ) : error ? (
          <div className="ui-surface p-5">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : data && s ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-4">

              {/* Profile Card */}
              <div className="ui-surface p-5">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold ui-text-primary leading-tight">
                      {s.firstName} {s.lastName}
                    </p>
                    <p className="text-xs ui-text-secondary mt-0.5">
                      {s.class?.name ?? 'Sans classe'} · {s.academicYear}
                    </p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      s.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {statusBadgeLabels[s.status] ?? s.status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label="N° d'admission" value={s.admissionNumber} />
                  <Field label="Classe" value={s.class?.name} />
                  <Field label="Niveau" value={s.class?.grade} />
                  <Field label="Année" value={String(s.academicYear)} />
                  {s.dateOfBirth && <Field label="Date de naissance" value={new Date(s.dateOfBirth).toLocaleDateString('fr-FR')} />}
                  {s.gender && <Field label="Genre" value={genderLabels[s.gender] ?? s.gender} />}
                </div>
              </div>

              {/* Attendance */}
              <div className="ui-surface p-5">
                <p className="text-xs font-semibold uppercase tracking-wider ui-text-secondary mb-3">
                  Assiduité
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-lg border border-(--border-subtle) bg-green-50 px-3 py-1.5 text-center">
                    <span className="block text-base font-bold text-green-700">{s.attendanceSummary.present}</span>
                    <span className="text-[10px] text-green-600">Présent</span>
                  </span>
                  <span className="rounded-lg border border-(--border-subtle) bg-red-50 px-3 py-1.5 text-center">
                    <span className="block text-base font-bold text-red-700">{s.attendanceSummary.absent}</span>
                    <span className="text-[10px] text-red-600">Absent</span>
                  </span>
                  <span className="rounded-lg border border-(--border-subtle) px-3 py-1.5 text-center" style={{ background: 'var(--surface-soft)' }}>
                    <span className="block text-base font-bold" style={{ color: 'var(--accent)' }}>{s.attendanceSummary.rate}%</span>
                    <span className="text-[10px] ui-text-secondary">Taux</span>
                  </span>
                </div>
              </div>

              {/* Parent */}
              {s.parent && (
                <div className="ui-surface p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider ui-text-secondary mb-3">
                    Parent / Tuteur
                  </p>
                  <div className="space-y-2">
                    <Field label="Nom" value={`${s.parent.firstName} ${s.parent.lastName}`} />
                    <Field label="E-mail" value={s.parent.email} />
                  </div>
                </div>
              )}

              {/* Subjects */}
              {s.class?.subjectAssignments && s.class.subjectAssignments.length > 0 && (
                <div className="ui-surface p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider ui-text-secondary mb-3">
                    Matières
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.class.subjectAssignments.map(cs => (
                      <span
                        key={cs.subject.id}
                        className="rounded-md px-2 py-1 text-xs font-medium border border-(--border-subtle)"
                        style={{ background: 'var(--surface-soft)', color: 'var(--accent)' }}
                      >
                        {cs.subject.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN – Assessment Results ── */}
            <div className="ui-surface p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold ui-text-primary">Résultats des évaluations</p>
                  {avgScore !== null && (
                    <p className="text-xs ui-text-secondary mt-0.5">
                      Moyenne : <span className="font-semibold" style={{ color: 'var(--accent)' }}>{avgScore}%</span>
                      {' '}sur {gradedResults.length} notée{gradedResults.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {['ALL', 'EXAM', 'TEST', 'QUIZ', 'ASSIGNMENT'].map(t => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        typeFilter === t
                          ? 'text-white'
                          : 'border border-(--border-subtle) ui-text-secondary hover:ui-text-primary'
                      }`}
                      style={typeFilter === t ? { background: 'var(--accent)' } : undefined}
                    >
                      {filterButtonLabels[t] ?? t}
                    </button>
                  ))}
                </div>
              </div>

              {results.length === 0 ? (
                <p className="py-8 text-center text-sm ui-text-secondary">Aucune évaluation pour l&apos;instant.</p>
              ) : filteredResults.length === 0 ? (
                <p className="py-8 text-center text-sm ui-text-secondary">Aucune évaluation de type {(filterButtonLabels[typeFilter] ?? typeFilter).toLowerCase()}.</p>
              ) : (
                <div className="overflow-auto rounded-lg border border-(--border-subtle)">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-(--border-subtle)" style={{ background: 'var(--surface-soft)' }}>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider ui-text-secondary">Évaluation</th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider ui-text-secondary">Matière</th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider ui-text-secondary">Type</th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider ui-text-secondary">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((r, i) => {
                        const pct = r.graded && r.score !== null
                          ? Math.round((r.score / r.assessment.totalMarks) * 100)
                          : null
                        return (
                          <tr
                            key={r.id}
                            className={`border-b border-(--border-subtle) last:border-0 ${i % 2 === 0 ? '' : ''}`}
                          >
                            <td className="px-3 py-2.5 font-medium ui-text-primary">{r.assessment.title}</td>
                            <td className="px-3 py-2.5 ui-text-secondary text-xs">{r.assessment.subject.name}</td>
                            <td className="px-3 py-2.5">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${typeColors[r.assessment.type] ?? 'bg-gray-100 text-gray-700'}`}>
                                {typeLabels[r.assessment.type] ?? r.assessment.type}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {r.graded && r.score !== null ? (
                                <span className={`font-semibold text-sm ${
                                  pct! >= 75 ? 'text-green-600' : pct! >= 50 ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                  {r.score}/{r.assessment.totalMarks}
                                  <span className="ml-1 text-[11px] font-normal ui-text-secondary">({pct}%)</span>
                                </span>
                              ) : (
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">En attente</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
