'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'

interface StudentOverviewResponse {
  student: {
    id: string
    firstName: string
    lastName: string
    admissionNumber: string | null
    dateOfBirth: string | null
    parentName: string | null
    parentEmail: string | null
    parentPhone: string | null
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
}

export default function StudentDetailsPage() {
  const params = useParams<{ id: string }>()
  const studentId = params?.id

  const { data: session, status } = useSession()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<StudentOverviewResponse | null>(null)

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
            <h1 className="text-3xl font-bold text-gray-900">Student Details</h1>
            <p className="text-gray-600 mt-1">Complete learner overview</p>
          </div>
          <Link
            href="/admin/students"
            className="px-4 py-2 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
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
              <h2 className="text-xl font-semibold text-gray-900">
                {data.student.firstName} {data.student.lastName}
              </h2>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div className="rounded border p-3">
                  <p className="text-gray-500">Admission No</p>
                  <p className="font-medium text-gray-900">{data.student.admissionNumber || '—'}</p>
                </div>
                <div className="rounded border p-3">
                  <p className="text-gray-500">Date of Birth</p>
                  <p className="font-medium text-gray-900">
                    {data.student.dateOfBirth ? new Date(data.student.dateOfBirth).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="rounded border p-3">
                  <p className="text-gray-500">Current Class</p>
                  <p className="font-medium text-gray-900">
                    {data.student.class.name}
                    {data.student.class.grade ? ` • ${data.student.class.grade}` : ''}
                  </p>
                </div>
                <div className="rounded border p-3">
                  <p className="text-gray-500">Academic Year</p>
                  <p className="font-medium text-gray-900">{data.student.academicYear}</p>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Assessments</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-700">Graded: {data.assessmentSummary.gradedCount}</p>
                  <p className="text-gray-700">
                    Average Score:{' '}
                    {typeof data.assessmentSummary.averageScore === 'number'
                      ? data.assessmentSummary.averageScore.toFixed(2)
                      : '—'}
                  </p>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Parent Details</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    Name:{' '}
                    {data.student.parentName ||
                      `${data.student.parent?.firstName || ''} ${data.student.parent?.lastName || ''}`.trim() ||
                      '—'}
                  </p>
                  <p>Email: {data.student.parentEmail || data.student.parent?.email || '—'}</p>
                  <p>Phone: {data.student.parentPhone || '—'}</p>
                </div>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Subjects</h3>
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
                          <td className="py-2 text-gray-900">{subject.name}</td>
                          <td className="py-2 text-gray-600">{subject.code || '—'}</td>
                          <td className="py-2 text-gray-600">{subject.teacherName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No subjects assigned to current class.</p>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Attendance Records</h3>
              {data.recentAttendance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Date</th>
                        <th className="text-left py-2">Status</th>
                        <th className="text-left py-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentAttendance.map((item) => (
                        <tr key={item.id} className="border-b last:border-b-0">
                          <td className="py-2 text-gray-900">{new Date(item.date).toLocaleDateString()}</td>
                          <td className="py-2 text-gray-600">{item.status}</td>
                          <td className="py-2 text-gray-600">{item.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No attendance records yet.</p>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Results Overview</h3>
              {data.results.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Subject</th>
                        <th className="text-left py-2">Term</th>
                        <th className="text-left py-2">Year</th>
                        <th className="text-left py-2">Score</th>
                        <th className="text-left py-2">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.results.map((result) => (
                        <tr key={result.id} className="border-b last:border-b-0">
                          <td className="py-2 text-gray-900">{result.subject.name}</td>
                          <td className="py-2 text-gray-600">{result.term}</td>
                          <td className="py-2 text-gray-600">{result.year}</td>
                          <td className="py-2 text-gray-600">
                            {typeof result.totalScore === 'number' ? `${result.totalScore}/${result.maxScore}` : '—'}
                          </td>
                          <td className="py-2 text-gray-600">{result.grade || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No results published for this student.</p>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Class History</h3>
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
                          <td className="py-2 text-gray-900">{new Date(entry.effectiveAt).toLocaleDateString()}</td>
                          <td className="py-2 text-gray-600">{entry.fromClass?.name || 'Initial assignment'}</td>
                          <td className="py-2 text-gray-600">{entry.toClass.name}</td>
                          <td className="py-2 text-gray-600">
                            {entry.changedBy
                              ? `${entry.changedBy.firstName || ''} ${entry.changedBy.lastName || ''}`.trim() || entry.changedBy.email
                              : 'System'}
                          </td>
                          <td className="py-2 text-gray-600">{entry.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No class history available yet.</p>
              )}
            </Card>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
