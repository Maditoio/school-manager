'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, redirect } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'

interface StudentOverviewResponse {
  student: {
    id: string
    firstName: string
    lastName: string
    status: 'ACTIVE' | 'LEFT'
    statusReason: 'SUSPENSION' | 'GRADUATION' | 'TRANSFERRED_SCHOOL' | 'OTHER' | null
    statusDate: string | null
    statusNotes: string | null
    admissionNumber: string | null
    dateOfBirth: string | null
    gender: string | null
    parentName: string | null
    parentEmail: string | null
    parentPhone: string | null
    academicYear: number
    class: {
      id: string
      name: string
      grade: string | null
    }
  }
  attendanceSummary: {
    present: number
    absent: number
    late: number
  }
  subjects: Array<{
    id: string
    name: string
    code: string | null
    teacherName: string
  }>
}

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

const leaveReasonLabels: Record<'SUSPENSION' | 'GRADUATION' | 'TRANSFERRED_SCHOOL' | 'OTHER', string> = {
  SUSPENSION: 'Suspension',
  GRADUATION: 'Graduation',
  TRANSFERRED_SCHOOL: 'Transferred',
  OTHER: 'Other',
}

const typeColors: Record<string, string> = {
  QUIZ: 'bg-purple-100 text-purple-700',
  TEST: 'bg-blue-100 text-blue-700',
  EXAM: 'bg-red-100 text-red-700',
  ASSIGNMENT: 'bg-amber-100 text-amber-700',
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider ui-text-secondary mb-0.5">{label}</p>
      <p className="text-sm font-medium ui-text-primary">{value || 'N/A'}</p>
    </div>
  )
}

export default function TeacherStudentDetailsPage() {
  const params = useParams<{ id: string }>()
  const studentId = params?.id
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<StudentOverviewResponse | null>(null)
  const [results, setResults] = useState<StudentAssessmentResult[]>([])
  const [resultsLoading, setResultsLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('ALL')

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role !== 'TEACHER') redirect('/login')
  }, [session, status])

  useEffect(() => {
    const load = async () => {
      if (!studentId || !session?.user) return
      try {
        setLoading(true)
        setError('')
        const res = await fetch(`/api/students/${studentId}/overview`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error || 'Failed to load student details')
          setData(null)
          return
        }
        setData((await res.json()) as StudentOverviewResponse)
      } catch {
        setError('Failed to load student details')
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [studentId, session])

  useEffect(() => {
    const loadResults = async () => {
      if (!studentId || !session?.user) return
      try {
        setResultsLoading(true)
        const res = await fetch(`/api/students/assessments?studentId=${studentId}`)
        if (res.ok) {
          const body = await res.json()
          setResults(Array.isArray(body.assessments) ? (body.assessments as StudentAssessmentResult[]) : [])
        }
      } catch {
        // Results are supplementary — fail silently
      } finally {
        setResultsLoading(false)
      }
    }
    loadResults()
  }, [studentId, session])

  if (status === 'loading' || !session) return null

  const s = data?.student
  const initials = s ? `${s.firstName[0]}${s.lastName[0]}`.toUpperCase() : '??'
  const total = (data?.attendanceSummary.present ?? 0) + (data?.attendanceSummary.absent ?? 0) + (data?.attendanceSummary.late ?? 0)
  const attendanceRate = total > 0 ? Math.round(((data?.attendanceSummary.present ?? 0) / total) * 100) : null

  const filteredResults = typeFilter === 'ALL' ? results : results.filter(r => r.assessment.type === typeFilter)
  const gradedResults = results.filter(r => r.graded && r.score !== null)
  const avgScore = gradedResults.length > 0
    ? Math.round(gradedResults.reduce((sum, r) => sum + (r.score! / r.assessment.totalMarks) * 100, 0) / gradedResults.length)
    : null

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Teacher',
        role: 'Teacher',
        email: session.user.email,
      }}
      navItems={TEACHER_NAV_ITEMS}
    >
      <div className="space-y-4">
        {/* Breadcrumb */}
        <Link
          href="/teacher/students"
          className="inline-flex items-center gap-1 text-[13px] ui-text-secondary hover:ui-text-primary transition-colors"
        >
          ← Students
        </Link>

        {loading ? (
          <div className="ui-surface p-6 flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent)" />
            <p className="text-sm ui-text-secondary">Loading student details…</p>
          </div>
        ) : error ? (
          <div className="ui-surface p-5">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : data && s ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-4">

              {/* Profile */}
              <div className="ui-surface p-5">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-base font-semibold ui-text-primary leading-snug">
                        {s.firstName} {s.lastName}
                      </h1>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {s.status === 'ACTIVE' ? 'Active' : `Left${s.statusReason ? ` · ${leaveReasonLabels[s.statusReason]}` : ''}`}
                      </span>
                    </div>
                    <p className="text-[12px] ui-text-secondary mt-0.5">
                      {s.class.name}{s.class.grade ? ` · ${s.class.grade}` : ''}
                      {s.admissionNumber ? ` · ${s.admissionNumber}` : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-(--border-subtle) pt-4">
                  <Field label="Date of Birth" value={s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : null} />
                  <Field label="Gender" value={s.gender} />
                  <Field label="Academic Year" value={String(s.academicYear)} />
                  <Field label="Status" value={s.status === 'ACTIVE' ? 'Active' : 'Left'} />
                </div>
              </div>

              {/* Attendance */}
              <div className="ui-surface p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold ui-text-primary">Attendance</h2>
                  {attendanceRate !== null && (
                    <span className="text-[12px] font-semibold ui-text-secondary">{attendanceRate}% rate</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 py-2.5 text-center">
                    <p className="text-xl font-bold text-emerald-700">{data.attendanceSummary.present}</p>
                    <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">Present</p>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-100 py-2.5 text-center">
                    <p className="text-xl font-bold text-red-600">{data.attendanceSummary.absent}</p>
                    <p className="text-[10px] font-medium text-red-500 uppercase tracking-wide">Absent</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-100 py-2.5 text-center">
                    <p className="text-xl font-bold text-amber-600">{data.attendanceSummary.late}</p>
                    <p className="text-[10px] font-medium text-amber-500 uppercase tracking-wide">Late</p>
                  </div>
                </div>
              </div>

              {/* Parent */}
              <div className="ui-surface p-5">
                <h2 className="text-sm font-semibold ui-text-primary mb-3">Parent / Guardian</h2>
                <div className="space-y-2.5">
                  <Field label="Name" value={s.parentName} />
                  <Field label="Email" value={s.parentEmail} />
                  <Field label="Phone" value={s.parentPhone} />
                </div>
              </div>

              {/* Subjects */}
              <div className="ui-surface p-5">
                <h2 className="text-sm font-semibold ui-text-primary mb-3">Subjects</h2>
                {data.subjects.length === 0 ? (
                  <p className="text-sm ui-text-secondary">No subjects assigned.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {data.subjects.map((subject) => (
                      <span
                        key={subject.id}
                        className="rounded-md border border-(--border-subtle) bg-(--surface-soft) px-2.5 py-1 text-[12px] font-medium ui-text-primary"
                      >
                        {subject.name}{subject.code ? ` (${subject.code})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN — Assessment Results ── */}
            <div className="ui-surface flex flex-col overflow-hidden p-0">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-(--border-subtle) px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold ui-text-primary">Assessment Results</h2>
                  {avgScore !== null && (
                    <p className="text-[12px] ui-text-secondary mt-0.5">
                      Average: <span className="font-semibold ui-text-primary">{avgScore}%</span>
                      {' · '}{gradedResults.length} graded
                    </p>
                  )}
                </div>
                {/* Type filter pills */}
                <div className="flex items-center gap-1 shrink-0">
                  {(['ALL', 'EXAM', 'TEST', 'QUIZ', 'ASSIGNMENT'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        typeFilter === t
                          ? 'bg-(--accent) text-white'
                          : 'border border-(--border-subtle) ui-text-secondary hover:ui-text-primary'
                      }`}
                    >
                      {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              {resultsLoading ? (
                <div className="flex flex-1 items-center justify-center gap-2 py-12">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent)" />
                  <p className="text-sm ui-text-secondary">Loading assessment results...</p>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="flex flex-1 items-center justify-center py-12">
                  <p className="text-sm ui-text-secondary">No assessment results found for the selected filters.</p>
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-(--border-subtle) text-[11px] font-medium uppercase tracking-wide ui-text-secondary">
                        <th className="px-5 py-2.5 text-left">Assessment</th>
                        <th className="px-4 py-2.5 text-left">Subject</th>
                        <th className="px-4 py-2.5 text-center">Type</th>
                        <th className="px-4 py-2.5 text-center">Score</th>
                        <th className="px-4 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-(--border-subtle)">
                      {filteredResults.map((r) => {
                        const pct = r.graded && r.score !== null
                          ? Math.round((r.score / r.assessment.totalMarks) * 100)
                          : null
                        const scoreColor = pct === null ? '' : pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'

                        return (
                          <tr key={r.id} className="hover:bg-(--surface-soft) transition-colors">
                            <td className="px-5 py-3">
                              <p className="font-medium ui-text-primary leading-snug">{r.assessment.title}</p>
                              {r.feedback && (
                                <p className="text-[11px] ui-text-secondary mt-0.5 max-w-50 truncate" title={r.feedback}>
                                  {r.feedback}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[13px] ui-text-secondary">
                              {r.assessment.subject.name}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeColors[r.assessment.type] ?? 'bg-gray-100 text-gray-600'}`}>
                                {r.assessment.type.charAt(0) + r.assessment.type.slice(1).toLowerCase()}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-center font-semibold text-[13px] ${scoreColor}`}>
                              {r.graded && r.score !== null
                                ? `${r.score}/${r.assessment.totalMarks}`
                                : <span className="ui-text-secondary font-normal">—</span>
                              }
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.graded ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  Graded
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                                  Not Graded
                                </span>
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
        ) : (
          <div className="ui-surface p-5">
            <p className="text-sm ui-text-secondary">No student data found.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
