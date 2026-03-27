'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, redirect } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'

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

const leaveReasonLabels: Record<'SUSPENSION' | 'GRADUATION' | 'TRANSFERRED_SCHOOL' | 'OTHER', string> = {
  SUSPENSION: 'Suspension',
  GRADUATION: 'Graduation',
  TRANSFERRED_SCHOOL: 'Transferred school',
  OTHER: 'Other',
}

export default function TeacherStudentDetailsPage() {
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
    if (session?.user?.role !== 'TEACHER') {
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
          setError(body.error || 'Failed to load student details')
          setData(null)
          return
        }

        const responseData = (await res.json()) as StudentOverviewResponse
        setData(responseData)
      } catch (loadError) {
        console.error('Failed to load student details:', loadError)
        setError('Failed to load student details')
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [studentId, session])

  const navItems = useMemo(
    () => [
      { label: 'Dashboard', href: '/teacher/dashboard', icon: '📊' },
      { label: 'My Classes', href: '/teacher/classes', icon: '🏫' },
      { label: 'Students', href: '/teacher/students', icon: '👨‍🎓' },
      { label: 'Assessments', href: '/teacher/assessments', icon: '📋' },
      { label: 'Attendance', href: '/teacher/attendance', icon: '📅' },
      { label: 'Results', href: '/teacher/results', icon: '📝' },
      { label: 'Announcements', href: '/teacher/announcements', icon: '📢' },
      { label: 'Messages', href: '/teacher/messages', icon: '💬' },
    ],
    []
  )

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Teacher',
        role: 'Teacher',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Student Details</h1>
            <p className="text-gray-700 mt-2">View student profile and attendance summary</p>
          </div>
          <Link
            href="/teacher/students"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 text-[13px] font-medium text-gray-800 transition-colors hover:bg-gray-50"
          >
            Back to Students
          </Link>
        </div>

        {loading ? (
          <Card className="p-6">
            <div>Loading student details...</div>
          </Card>
        ) : error ? (
          <Card className="p-6">
            <p className="text-red-600">{error}</p>
          </Card>
        ) : data ? (
          <>
            <Card className="p-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Full Name</p>
                  <p className="text-base font-semibold text-gray-900">
                    {data.student.firstName} {data.student.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Admission Number</p>
                  <p className="text-base font-semibold text-gray-900">{data.student.admissionNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Class</p>
                  <p className="text-base font-semibold text-gray-900">
                    {data.student.class.name}
                    {data.student.class.grade ? ` (${data.student.class.grade})` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Gender</p>
                  <p className="text-base font-semibold text-gray-900">{data.student.gender || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Date of Birth</p>
                  <p className="text-base font-semibold text-gray-900">
                    {data.student.dateOfBirth ? new Date(data.student.dateOfBirth).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
                  <p className="text-base font-semibold text-gray-900">
                    {data.student.status === 'ACTIVE' ? 'Active' : 'Left'}
                    {data.student.statusReason ? ` (${leaveReasonLabels[data.student.statusReason]})` : ''}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Parent/Guardian Contact</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Name</p>
                  <p className="text-base font-medium text-gray-900">{data.student.parentName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Email</p>
                  <p className="text-base font-medium text-gray-900">{data.student.parentEmail || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Phone</p>
                  <p className="text-base font-medium text-gray-900">{data.student.parentPhone || 'N/A'}</p>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="p-6">
                <p className="text-xs uppercase tracking-wide text-gray-500">Present</p>
                <p className="text-2xl font-bold text-green-700">{data.attendanceSummary.present}</p>
              </Card>
              <Card className="p-6">
                <p className="text-xs uppercase tracking-wide text-gray-500">Absent</p>
                <p className="text-2xl font-bold text-red-700">{data.attendanceSummary.absent}</p>
              </Card>
              <Card className="p-6">
                <p className="text-xs uppercase tracking-wide text-gray-500">Late</p>
                <p className="text-2xl font-bold text-amber-700">{data.attendanceSummary.late}</p>
              </Card>
            </div>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Subjects</h2>
              {data.subjects.length === 0 ? (
                <p className="text-gray-600">No subjects assigned.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {data.subjects.map((subject) => (
                    <div key={subject.id} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <p className="font-semibold text-gray-900">{subject.name}</p>
                      <p className="text-sm text-gray-700">Code: {subject.code || 'N/A'}</p>
                      <p className="text-sm text-gray-700">Teacher: {subject.teacherName}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        ) : (
          <Card className="p-6">
            <p className="text-gray-700">No student data found.</p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
