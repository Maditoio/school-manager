'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import Table from '@/components/ui/Table'

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
    parentName: string | null
    parentEmail: string | null
    parentPhone: string | null
    emergencyContactName: string | null
    emergencyContactPhone: string | null
    academicYear: number
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
    status: 'PRESENT' | 'ABSENT' | 'LATE'
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
    status: 'ACTIVE' | 'LEFT'
    reason: 'SUSPENSION' | 'GRADUATION' | 'TRANSFERRED_SCHOOL' | 'OTHER' | null
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

const leaveReasonLabels: Record<'SUSPENSION' | 'GRADUATION' | 'TRANSFERRED_SCHOOL' | 'OTHER', string> = {
  SUSPENSION: 'Suspension',
  GRADUATION: 'Graduation',
  TRANSFERRED_SCHOOL: 'Change of school',
  OTHER: 'Other',
}

export default function StudentDetailsPage() {
  const params = useParams<{ id: string }>()
  const studentId = params?.id

  const { data: session, status } = useSession()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<StudentOverviewResponse | null>(null)
  const [attendanceSearch, setAttendanceSearch] = useState('')
  const [attendancePage, setAttendancePage] = useState(1)
  const [resultsSearch, setResultsSearch] = useState('')
  const [resultsPage, setResultsPage] = useState(1)
  const pageSize = 8

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN') {
      redirect('/login')
    }
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
          setError(body.error || 'Failed to load student overview')
          setData(null)
          return
        }

        const responseData = (await res.json()) as StudentOverviewResponse
        setData(responseData)
      } catch (loadError) {
        console.error('Failed to load student overview:', loadError)
        setError('Failed to load student overview')
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [studentId, session])

  const navItems = useMemo(
    () => [
      { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
      { label: 'Students', href: '/admin/students', icon: '👨‍🎓' },
      { label: 'Teachers', href: '/admin/teachers', icon: '👨‍🏫' },
      { label: 'Classes', href: '/admin/classes', icon: '🏫' },
      { label: 'Subjects', href: '/admin/subjects', icon: '📚' },
      { label: 'Attendance', href: '/admin/attendance', icon: '📅' },
      { label: 'Results', href: '/admin/results', icon: '📝' },
      { label: 'Announcements', href: '/admin/announcements', icon: '📢' },
      { label: 'Messages', href: '/admin/messages', icon: '💬' },
    ],
    []
  )

  const filteredAttendance = useMemo(() => {
    if (!data) return []
    const query = attendanceSearch.trim().toLowerCase()
    if (!query) return data.recentAttendance

    return data.recentAttendance.filter((item) => {
      const formattedDate = new Date(item.date).toLocaleDateString().toLowerCase()
      return (
        item.status.toLowerCase().includes(query) ||
        formattedDate.includes(query) ||
        String(item.notes || '')
          .toLowerCase()
          .includes(query)
      )
    })
  }, [attendanceSearch, data])

  const filteredResults = useMemo(() => {
    if (!data) return []
    const query = resultsSearch.trim().toLowerCase()
    if (!query) return data.results

    return data.results.filter((result) => {
      return (
        result.subject.name.toLowerCase().includes(query) ||
        String(result.subject.code || '')
          .toLowerCase()
          .includes(query) ||
        result.term.toLowerCase().includes(query) ||
        String(result.year).includes(query) ||
        String(result.grade || '')
          .toLowerCase()
          .includes(query)
      )
    })
  }, [data, resultsSearch])

  const attendancePageRows = useMemo(() => {
    const start = (attendancePage - 1) * pageSize
    return filteredAttendance.slice(start, start + pageSize)
  }, [attendancePage, filteredAttendance])

  const resultsPageRows = useMemo(() => {
    const start = (resultsPage - 1) * pageSize
    return filteredResults.slice(start, start + pageSize)
  }, [filteredResults, resultsPage])

  const attendanceColumns = useMemo(
    () => [
      {
        key: 'date',
        label: 'Date',
        sortable: true,
        renderCell: (item: StudentOverviewResponse['recentAttendance'][number]) =>
          new Date(item.date).toLocaleDateString(),
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
      },
      {
        key: 'notes',
        label: 'Notes',
        renderCell: (item: StudentOverviewResponse['recentAttendance'][number]) => item.notes || '—',
      },
    ],
    []
  )

  const resultColumns = useMemo(
    () => [
      {
        key: 'subject',
        label: 'Subject',
        sortable: true,
        renderCell: (result: StudentOverviewResponse['results'][number]) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-100">{result.subject.name}</span>
            <span className="text-xs text-slate-400">{result.subject.code || 'No code'}</span>
          </div>
        ),
      },
      {
        key: 'term',
        label: 'Term',
        sortable: true,
      },
      {
        key: 'year',
        label: 'Year',
        sortable: true,
      },
      {
        key: 'score',
        label: 'Score',
        renderCell: (result: StudentOverviewResponse['results'][number]) =>
          typeof result.totalScore === 'number' ? `${result.totalScore}/${result.maxScore}` : '—',
      },
      {
        key: 'grade',
        label: 'Grade',
        sortable: true,
        renderCell: (result: StudentOverviewResponse['results'][number]) => result.grade || '—',
      },
    ],
    []
  )

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-bold ui-text-primary">Student Details</h1>
            <p className="mt-1 ui-text-secondary">Complete learner overview</p>
          </div>
          <Link
            href="/admin/students"
            className="px-4 py-2 text-sm rounded-lg bg-(--surface-soft) ui-text-secondary hover:ui-text-primary transition-colors"
          >
            Back to Students
          </Link>
        </div>

        {loading ? (
          <div>Loading student details...</div>
        ) : error ? (
          <Card className="p-6">
            <p className="text-sm text-red-600">{error}</p>
          </Card>
        ) : data ? (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold ui-text-primary">
                {data.student.firstName} {data.student.lastName}
              </h2>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="ui-text-secondary">Admission No</p>
                  <p className="font-medium ui-text-primary">{data.student.admissionNumber || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="ui-text-secondary">Status</p>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      data.student.status === 'LEFT' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {data.student.status === 'LEFT' ? 'Left School' : 'Active'}
                  </span>
                  {data.student.statusReason ? (
                    <p className="mt-2 text-xs ui-text-secondary">Reason: {leaveReasonLabels[data.student.statusReason]}</p>
                  ) : null}
                  {data.student.statusDate ? (
                    <p className="text-xs ui-text-secondary">Date: {new Date(data.student.statusDate).toLocaleDateString()}</p>
                  ) : null}
                  {data.student.statusNotes ? (
                    <p className="text-xs ui-text-secondary">Notes: {data.student.statusNotes}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <p className="ui-text-secondary">Date of Birth</p>
                  <p className="font-medium ui-text-primary">
                    {data.student.dateOfBirth ? new Date(data.student.dateOfBirth).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="ui-text-secondary">Current Class</p>
                  <p className="font-medium ui-text-primary">
                    {data.student.class.name}
                    {data.student.class.grade ? ` • ${data.student.class.grade}` : ''}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="ui-text-secondary">Academic Year</p>
                  <p className="font-medium ui-text-primary">{data.student.academicYear}</p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Attendance</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-green-700">Present: {data.attendanceSummary.present}</p>
                  <p className="text-red-700">Absent: {data.attendanceSummary.absent}</p>
                  <p className="text-amber-700">Late: {data.attendanceSummary.late}</p>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold ui-text-primary mb-3">Assessments</h3>
                <div className="space-y-2 text-sm">
                  <p className="ui-text-secondary">Graded: {data.assessmentSummary.gradedCount}</p>
                  <p className="ui-text-secondary">
                    Average Score:{' '}
                    {typeof data.assessmentSummary.averageScore === 'number'
                      ? data.assessmentSummary.averageScore.toFixed(2)
                      : '—'}
                  </p>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold ui-text-primary mb-3">Parent Details</h3>
                <div className="space-y-2 text-sm ui-text-secondary">
                  <p>
                    Name:{' '}
                    {data.student.parentName ||
                      `${data.student.parent?.firstName || ''} ${data.student.parent?.lastName || ''}`.trim() ||
                      '—'}
                  </p>
                  <p>Email: {data.student.parentEmail || data.student.parent?.email || '—'}</p>
                  <p>Phone: {data.student.parentPhone || '—'}</p>
                  <p className="pt-2 font-medium ui-text-primary">Emergency Contact</p>
                  <p>Name: {data.student.emergencyContactName || '—'}</p>
                  <p>Phone: {data.student.emergencyContactPhone || '—'}</p>
                </div>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold ui-text-primary mb-3">Subjects</h3>
              {data.subjects.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Subject</th>
                        <th className="text-left py-2">Code</th>
                        <th className="text-left py-2">Teacher</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.subjects.map((subject) => (
                        <tr key={subject.id} className="border-b last:border-b-0">
                          <td className="py-2 ui-text-primary">{subject.name}</td>
                          <td className="py-2 ui-text-secondary">{subject.code || '—'}</td>
                          <td className="py-2 ui-text-secondary">{subject.teacherName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm ui-text-secondary">No subjects assigned to current class.</p>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold ui-text-primary mb-3">Recent Attendance Records</h3>
              <Table
                title="Attendance Timeline"
                columns={attendanceColumns}
                data={attendancePageRows}
                totalCount={filteredAttendance.length}
                page={attendancePage}
                pageSize={pageSize}
                onSearch={(value: string) => {
                  setAttendanceSearch(value)
                  setAttendancePage(1)
                }}
                onPageChange={setAttendancePage}
                onFilterClick={() => {
                  setAttendanceSearch('')
                  setAttendancePage(1)
                }}
                emptyMessage="No attendance records yet."
                rowKey="id"
              />
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold ui-text-primary mb-3">Results Overview</h3>
              <Table
                title="Academic Results"
                columns={resultColumns}
                data={resultsPageRows}
                totalCount={filteredResults.length}
                page={resultsPage}
                pageSize={pageSize}
                onSearch={(value: string) => {
                  setResultsSearch(value)
                  setResultsPage(1)
                }}
                onPageChange={setResultsPage}
                onFilterClick={() => {
                  setResultsSearch('')
                  setResultsPage(1)
                }}
                emptyMessage="No results published for this student."
                rowKey="id"
              />
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold ui-text-primary mb-3">Class History</h3>
              {data.classHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Date</th>
                        <th className="text-left py-2">From Class</th>
                        <th className="text-left py-2">To Class</th>
                        <th className="text-left py-2">Changed By</th>
                        <th className="text-left py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.classHistory.map((entry) => (
                        <tr key={entry.id} className="border-b last:border-b-0">
                          <td className="py-2 ui-text-primary">{new Date(entry.effectiveAt).toLocaleDateString()}</td>
                          <td className="py-2 ui-text-secondary">{entry.fromClass?.name || 'Initial assignment'}</td>
                          <td className="py-2 ui-text-secondary">{entry.toClass.name}</td>
                          <td className="py-2 ui-text-secondary">
                            {entry.changedBy
                              ? `${entry.changedBy.firstName || ''} ${entry.changedBy.lastName || ''}`.trim() || entry.changedBy.email
                              : 'System'}
                          </td>
                          <td className="py-2 ui-text-secondary">{entry.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm ui-text-secondary">No class history available yet.</p>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold ui-text-primary mb-3">Status History</h3>
              {data.statusHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Date</th>
                        <th className="text-left py-2">Status</th>
                        <th className="text-left py-2">Reason</th>
                        <th className="text-left py-2">Notes</th>
                        <th className="text-left py-2">Updated By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.statusHistory.map((entry) => (
                        <tr key={entry.id} className="border-b last:border-b-0">
                          <td className="py-2 ui-text-primary">{new Date(entry.effectiveAt).toLocaleDateString()}</td>
                          <td className="py-2 ui-text-secondary">{entry.status === 'LEFT' ? 'Left School' : 'Active'}</td>
                          <td className="py-2 ui-text-secondary">{entry.reason ? leaveReasonLabels[entry.reason] : '—'}</td>
                          <td className="py-2 ui-text-secondary">{entry.notes || '—'}</td>
                          <td className="py-2 ui-text-secondary">
                            {entry.changedBy
                              ? `${entry.changedBy.firstName || ''} ${entry.changedBy.lastName || ''}`.trim() || entry.changedBy.email
                              : 'System'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm ui-text-secondary">No status changes logged yet.</p>
              )}
            </Card>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
