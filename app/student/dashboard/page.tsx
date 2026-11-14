'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'
import { useStudentUi } from '@/lib/use-student-ui'

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

interface StudentCourseProfile {
  termId: string
  termName: string
  academicYear: number
  termAverage: number
  overallPassRate: number
  subjectAverages: Array<{
    subjectId: string
    subjectName: string
    average: number
    passRate: number
    attempts: number
    passedCount: number
  }>
  strongSubjects: Array<{
    subjectId: string
    subjectName: string
    average: number
    passRate: number
  }>
  weakSubjects: Array<{
    subjectId: string
    subjectName: string
    average: number
    passRate: number
  }>
  recommendationTags: string[]
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
  studentCourseProfile?: StudentCourseProfile | null
}

const typeColors: Record<string, string> = {
  QUIZ: 'bg-purple-100 text-purple-700',
  TEST: 'bg-blue-100 text-blue-700',
  EXAM: 'bg-red-100 text-red-700',
  ASSIGNMENT: 'bg-amber-100 text-amber-700',
}

const statusDotStyles: Record<string, string> = {
  PRESENT: 'bg-emerald-500',
  ABSENT: 'bg-rose-500',
  LATE: 'bg-amber-500',
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[0.6875rem] font-medium uppercase tracking-wider ui-text-secondary mb-0.5">{label}</p>
      <p className="text-sm font-medium ui-text-primary">{value || '-'}</p>
    </div>
  )
}

export default function StudentDashboardPage() {
  const { data: session, status } = useSession()
  const { locale, tStudent } = useStudentUi()
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
          setError(body.error || tStudent('profileLoadFailed', 'Failed to load profile'))
          return
        }
        setData(await res.json())
      } catch {
        setError(tStudent('profileLoadFailed', 'Failed to load profile'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session, tStudent])

  if (status === 'loading' || !session) return null

  const s = data?.student
  const initials = s ? `${s.firstName[0]}${s.lastName[0]}`.toUpperCase() : '??'
  const results: StudentAssessmentResult[] = s?.studentAssessments ?? []
  const filteredResults = typeFilter === 'ALL' ? results : results.filter(r => r.assessment.type === typeFilter)
  const gradedResults = results.filter(r => r.graded && r.score !== null)
  const recentAttendance = [...(s?.attendance ?? [])]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
  const avgScore = gradedResults.length > 0
    ? Math.round(gradedResults.reduce((sum, r) => sum + (r.score! / r.assessment.totalMarks) * 100, 0) / gradedResults.length)
    : null
  const restrictedFeaturesBlocked = Boolean(session.user.paymentAccessBlocked)
  const profile = data?.studentCourseProfile
  const topWeakSubject = profile?.weakSubjects?.[0]
  const topStrongSubject = profile?.strongSubjects?.[0]
  const dateLocale = locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-TZ' : 'en-GB'

  const typeLabels: Record<string, string> = {
    QUIZ: tStudent('quiz', 'Quiz'),
    TEST: tStudent('test', 'Test'),
    EXAM: tStudent('exam', 'Exam'),
    ASSIGNMENT: tStudent('assignment', 'Assignment'),
  }

  const filterButtonLabels: Record<string, string> = {
    ALL: tStudent('all', 'All'),
    EXAM: typeLabels.EXAM,
    TEST: typeLabels.TEST,
    QUIZ: typeLabels.QUIZ,
    ASSIGNMENT: typeLabels.ASSIGNMENT,
  }

  const genderLabels: Record<string, string> = {
    MALE: tStudent('male', 'Male'),
    FEMALE: tStudent('female', 'Female'),
    OTHER: tStudent('other', 'Other'),
  }

  const statusBadgeLabels: Record<string, string> = {
    ACTIVE: tStudent('statusActive', 'ACTIVE'),
    INACTIVE: tStudent('statusInactive', 'INACTIVE'),
    SUSPENDED: tStudent('statusSuspended', 'SUSPENDED'),
  }

  const statusTextLabels: Record<string, string> = {
    PRESENT: tStudent('present', 'Present'),
    ABSENT: tStudent('absent', 'Absent'),
    LATE: tStudent('late', 'Late'),
  }

  const averageSummaryText =
    avgScore === null
      ? ''
      : tStudent('averageAcross', 'Average: {avg}% across {count} graded assessment(s)', {
          avg: avgScore,
          count: gradedResults.length,
        })

  const formatDay = (value: string) =>
    new Date(value).toLocaleDateString(dateLocale, { weekday: 'short' })

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Student',
        role: 'Student',
        email: session.user.email,
      }}
      navItems={STUDENT_NAV_ITEMS}
    >
      <div className="space-y-4">
        <h1 className="text-lg font-semibold ui-text-primary">{tStudent('myProfile', 'My Profile')}</h1>

        {loading ? (
          <div className="ui-surface p-6 flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent)" />
            <p className="text-sm ui-text-secondary">{tStudent('loadingProfile', 'Loading profile...')}</p>
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
                    {/* <p className="text-xs ui-text-secondary mt-0.5">
                      {s.class?.name ?? 'Sans classe'} · {s.academicYear}
                    </p> */}
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${
                      s.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {statusBadgeLabels[s.status] ?? s.status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label={tStudent('admissionNumber', 'Admission Number')} value={s.admissionNumber} />
                  <Field label={tStudent('class', 'Class')} value={s.class?.name} />
                  <Field label={tStudent('year', 'Year')} value={String(s.academicYear)} />
                  {s.dateOfBirth && <Field label={tStudent('dateOfBirth', 'Date of Birth')} value={new Date(s.dateOfBirth).toLocaleDateString(dateLocale)} />}
                  {s.gender && <Field label={tStudent('gender', 'Gender')} value={genderLabels[s.gender] ?? s.gender} />}
                </div>
              </div>

              {profile && (
                <div className="ui-surface p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider ui-text-secondary mb-3">
                    {tStudent('learningProfile', 'Learning Profile')}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-(--border-subtle) p-4">
                      <p className="text-[0.6875rem] ui-text-secondary">{tStudent('termAverage', 'Term Average')}</p>
                      <p className="mt-2 text-2xl font-semibold ui-text-primary">{profile.termAverage}%</p>
                      <p className="text-[0.6875rem] ui-text-secondary mt-2">{profile.termName}</p>
                    </div>
                    <div className="rounded-2xl border border-(--border-subtle) p-4">
                      <p className="text-[0.6875rem] ui-text-secondary">{tStudent('passRate', 'Pass Rate')}</p>
                      <p className="mt-2 text-2xl font-semibold ui-text-primary">{profile.overallPassRate}%</p>
                      <p className="text-[0.6875rem] ui-text-secondary mt-2">{tStudent('basedOnCurrentSubjects', 'Based on current subjects')}</p>
                    </div>
                    <div className="rounded-2xl border border-(--border-subtle) p-4">
                      <p className="text-[0.6875rem] ui-text-secondary">{tStudent('focus', 'Focus')}</p>
                      <p className="mt-2 text-sm ui-text-primary">
                        {topWeakSubject
                          ? `${tStudent('supportIn', 'Support in')} ${topWeakSubject.subjectName}`
                          : tStudent('noWeakSubject', 'No weak subject')}
                      </p>
                      <p className="text-[0.6875rem] ui-text-secondary mt-2">
                        {topStrongSubject
                          ? `${tStudent('strongIn', 'Strong in')} ${topStrongSubject.subjectName}`
                          : tStudent('noStrongSubjectYet', 'No strong subject yet')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Attendance */}
              <div className="ui-surface p-5">
                <p className="text-xs font-semibold uppercase tracking-wider ui-text-secondary mb-3">
                  {tStudent('attendance', 'Attendance')}
                </p>
                {restrictedFeaturesBlocked ? (
                  <div className="rounded-xl border px-4 py-5 text-sm text-amber-700" style={{ borderColor: '#fcd34d', background: '#fffbeb' }}>
                    {session.user.paymentAccessReason ||
                      tStudent(
                        'attendanceLocked',
                        'Attendance is unavailable until the school records license coverage for this student.'
                      )}
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {recentAttendance.length > 0 ? (
                        [...recentAttendance].reverse().map((record) => (
                          <div
                            key={`${record.date}-${record.status}`}
                            className="flex min-w-18 flex-col items-center rounded-2xl border px-3 py-2"
                            style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}
                          >
                            <span className="text-xs font-semibold ui-text-primary">{formatDay(record.date)}</span>
                            <span className="mt-2 text-[0.625rem] ui-text-secondary">{formatDate(record.date)}</span>
                            <span
                              className={`mt-2 h-3 w-3 rounded-full ${statusDotStyles[record.status] || 'bg-slate-500'}`}
                              title={statusTextLabels[record.status] || record.status}
                            />
                          </div>
                        ))
                      ) : (
                        <div className="w-full rounded-xl border px-4 py-5 text-center text-sm ui-text-secondary" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}>
                          {tStudent('noAttendanceRecordsYet', 'No attendance records yet')}
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-lg border border-(--border-subtle) bg-green-50 px-3 py-1.5 text-center">
                        <span className="block text-base font-bold text-green-700">{s.attendanceSummary.present}</span>
                        <span className="text-[0.625rem] text-green-600">{tStudent('present', 'Present')}</span>
                      </span>
                      <span className="rounded-lg border border-(--border-subtle) bg-red-50 px-3 py-1.5 text-center">
                        <span className="block text-base font-bold text-red-700">{s.attendanceSummary.absent}</span>
                        <span className="text-[0.625rem] text-red-600">{tStudent('absent', 'Absent')}</span>
                      </span>
                      <span className="rounded-lg border border-(--border-subtle) px-3 py-1.5 text-center" style={{ background: 'var(--surface-soft)' }}>
                        <span className="block text-base font-bold" style={{ color: 'var(--accent)' }}>{s.attendanceSummary.rate}%</span>
                        <span className="text-[0.625rem] ui-text-secondary">{tStudent('rate', 'Rate')}</span>
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Parent */}
              {s.parent && (
                <div className="ui-surface p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider ui-text-secondary mb-3">
                    {tStudent('parentGuardian', 'Parent / Guardian')}
                  </p>
                  <div className="space-y-2">
                    <Field label={tStudent('name', 'Name')} value={`${s.parent.firstName} ${s.parent.lastName}`} />
                    <Field label={tStudent('email', 'Email')} value={s.parent.email} />
                  </div>
                </div>
              )}

              {/* Subjects */}
              {s.class?.subjectAssignments && s.class.subjectAssignments.length > 0 && (
                <div className="ui-surface p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider ui-text-secondary mb-3">
                    {tStudent('subjects', 'Subjects')}
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
                  <p className="text-sm font-semibold ui-text-primary">{tStudent('assessmentResults', 'Assessment Results')}</p>
                  {!restrictedFeaturesBlocked && avgScore !== null && (
                    <p className="text-xs ui-text-secondary mt-0.5">
                      <span className="font-semibold" style={{ color: 'var(--accent)' }}>{averageSummaryText}</span>
                    </p>
                  )}
                </div>
                {!restrictedFeaturesBlocked ? (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {['ALL', 'EXAM', 'TEST', 'QUIZ', 'ASSIGNMENT'].map((filterKey) => (
                    <button
                      key={filterKey}
                      type="button"
                      onClick={() => setTypeFilter(filterKey)}
                      className={`min-h-11 shrink-0 rounded-[6px] px-3 text-xs font-medium transition-all duration-150 active:scale-[0.97] ${
                        typeFilter === filterKey
                          ? 'text-white'
                          : 'border border-(--border-subtle) ui-text-secondary'
                      }`}
                      style={typeFilter === filterKey ? { background: '#635bff' } : undefined}
                    >
                      {filterButtonLabels[filterKey] ?? filterKey}
                    </button>
                  ))}
                </div>
                ) : null}
              </div>

              {restrictedFeaturesBlocked ? (
                <div className="rounded-xl border px-4 py-5 text-sm text-amber-700" style={{ borderColor: '#fcd34d', background: '#fffbeb' }}>
                  {session.user.paymentAccessReason ||
                    tStudent(
                      'resultsLocked',
                      'Assessment results are unavailable until the school records license coverage for this student.'
                    )}
                </div>
              ) : results.length === 0 ? (
                <p className="py-8 text-center text-sm ui-text-secondary">
                  {tStudent('noAssessmentsYet', 'No assessments yet.')}
                </p>
              ) : filteredResults.length === 0 ? (
                <p className="py-8 text-center text-sm ui-text-secondary">
                  {tStudent('noFilterAssessments', 'No {type} assessments yet.', {
                    type: filterButtonLabels[typeFilter] ?? typeFilter,
                  })}
                </p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-2 md:hidden">
                    {filteredResults.map((r) => {
                      const pct =
                        r.graded && r.score !== null
                          ? Math.round((r.score / r.assessment.totalMarks) * 100)
                          : null
                      return (
                        <div
                          key={r.id}
                          className="rounded-[10px] border border-(--border-subtle) bg-(--surface-card) p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold ui-text-primary">{r.assessment.title}</p>
                              <p className="mt-0.5 text-xs ui-text-secondary">{r.assessment.subject.name}</p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${
                                typeColors[r.assessment.type] ?? 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {typeLabels[r.assessment.type] ?? r.assessment.type}
                            </span>
                          </div>
                          <div className="mt-2 text-sm font-semibold ui-text-primary">
                            {r.graded && r.score !== null ? (
                              <>
                                {r.score}/{r.assessment.totalMarks}
                                <span className="ml-1 text-[0.6875rem] font-normal ui-text-secondary">({pct}%)</span>
                              </>
                            ) : (
                              <span className="text-xs font-medium ui-text-secondary">{tStudent('pending', 'Pending')}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden overflow-auto rounded-lg border border-(--border-subtle) md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-(--border-subtle)" style={{ background: 'var(--surface-soft)' }}>
                          <th className="px-3 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wider ui-text-secondary">
                            {tStudent('assessment', 'Assessment')}
                          </th>
                          <th className="px-3 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wider ui-text-secondary">
                            {tStudent('subject', 'Subject')}
                          </th>
                          <th className="px-3 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wider ui-text-secondary">
                            {tStudent('type', 'Type')}
                          </th>
                          <th className="px-3 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-wider ui-text-secondary">
                            {tStudent('score', 'Score')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((r) => {
                          const pct =
                            r.graded && r.score !== null
                              ? Math.round((r.score / r.assessment.totalMarks) * 100)
                              : null
                          return (
                            <tr key={r.id} className="border-b border-(--border-subtle) last:border-0">
                              <td className="px-3 py-2.5 font-medium ui-text-primary">{r.assessment.title}</td>
                              <td className="px-3 py-2.5 text-xs ui-text-secondary">{r.assessment.subject.name}</td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${
                                    typeColors[r.assessment.type] ?? 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {typeLabels[r.assessment.type] ?? r.assessment.type}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {r.graded && r.score !== null ? (
                                  <span
                                    className={`text-sm font-semibold ${
                                      pct! >= 75
                                        ? 'text-green-600'
                                        : pct! >= 50
                                          ? 'text-amber-600'
                                          : 'text-red-600'
                                    }`}
                                  >
                                    {r.score}/{r.assessment.totalMarks}
                                    <span className="ml-1 text-[0.6875rem] font-normal ui-text-secondary">({pct}%)</span>
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.6875rem] text-gray-500">
                                    {tStudent('pending', 'Pending')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
