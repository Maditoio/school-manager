'use client'

import { useCallback, useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect, useParams } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

type ClassDetails = {
  id: string
  name: string
}

type Subject = {
  id: string
  name: string
  code: string | null
}

type Teacher = {
  id: string
  firstName: string
  lastName: string
}

type Assignment = {
  id: string
  subject: Subject
  teacher: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  }
}

export default function ClassSubjectsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const params = useParams<{ id: string }>()
  const classId = params?.id

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    subjectId: '',
    teacherId: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  const fetchData = useCallback(async () => {
    if (!classId) {
      return
    }

    try {
      setLoading(true)

      const [classRes, subjectsRes, teachersRes, assignmentsRes] = await Promise.all([
        fetch(`/api/classes/${classId}`),
        fetch('/api/subjects'),
        fetch('/api/users?role=TEACHER'),
        fetch(`/api/classes/${classId}/subjects`),
      ])

      if (classRes.ok) {
        const data = await classRes.json()
        setClassDetails(data.class || null)
      }

      if (subjectsRes.ok) {
        const data = await subjectsRes.json()
        setSubjects(Array.isArray(data.subjects) ? data.subjects : [])
      }

      if (teachersRes.ok) {
        const data = await teachersRes.json()
        setTeachers(Array.isArray(data.users) ? data.users : [])
      }

      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json()
        setAssignments(Array.isArray(data.assignments) ? data.assignments : [])
      }
    } catch (error) {
      console.error('Failed to fetch class subject assignment data:', error)
      showToast('Failed to load class subject assignments', 'error')
    } finally {
      setLoading(false)
    }
  }, [classId, showToast])

  useEffect(() => {
    if (session && classId) {
      fetchData()
    }
  }, [session, classId, fetchData])

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!classId || !formData.subjectId || !formData.teacherId) {
      showToast('Please select both subject and teacher', 'warning')
      return
    }

    try {
      setSaving(true)
      const res = await fetch(`/api/classes/${classId}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: formData.subjectId,
          teacherId: formData.teacherId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'Failed to assign subject', 'error')
        return
      }

      setFormData({ subjectId: '', teacherId: '' })
      showToast('Subject assignment saved', 'success')
      await fetchData()
    } catch (error) {
      console.error('Failed to assign subject:', error)
      showToast('Failed to assign subject', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (subjectId: string) => {
    if (!classId) return
    if (!confirm('Remove this subject assignment from class?')) return

    try {
      const res = await fetch(`/api/classes/${classId}/subjects?subjectId=${encodeURIComponent(subjectId)}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'Failed to remove assignment', 'error')
        return
      }

      showToast('Subject assignment removed', 'success')
      await fetchData()
    } catch (error) {
      console.error('Failed to remove assignment:', error)
      showToast('Failed to remove assignment', 'error')
    }
  }

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { label: 'Students', href: '/admin/students', icon: '👨‍🎓' },
    { label: 'Teachers', href: '/admin/teachers', icon: '👨‍🏫' },
    { label: 'Classes', href: '/admin/classes', icon: '🏫' },
    { label: 'Subjects', href: '/admin/subjects', icon: '📚' },
    { label: 'Attendance', href: '/admin/attendance', icon: '📅' },
    { label: 'Results', href: '/admin/results', icon: '📝' },
    { label: 'Announcements', href: '/admin/announcements', icon: '📢' },
    { label: 'Messages', href: '/admin/messages', icon: '💬' },
  ]

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Class Subject Assignment</h1>
            <p className="text-gray-600 mt-2">
              Class: <span className="font-semibold">{classDetails?.name || 'Loading...'}</span>
            </p>
          </div>
          <a
            href="/admin/classes"
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            ← Back to Classes
          </a>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Assign Subject to Class</h2>
          <form onSubmit={handleAssign} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <Select
              label="Subject"
              value={formData.subjectId}
              onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
              className="text-gray-900 bg-white"
              required
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}{subject.code ? ` (${subject.code})` : ''}
                </option>
              ))}
            </Select>

            <Select
              label="Teacher"
              value={formData.teacherId}
              onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
              className="text-gray-900 bg-white"
              required
            >
              <option value="">Select teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.firstName} {teacher.lastName}
                </option>
              ))}
            </Select>

            <div>
              <Button type="submit" isLoading={saving}>
                Save Assignment
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Assigned Subjects</h2>
          {loading ? (
            <div>Loading assignments...</div>
          ) : assignments.length > 0 ? (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{assignment.subject.name}</p>
                    <p className="text-sm text-gray-600">
                      Teacher: {(assignment.teacher.firstName || '')} {(assignment.teacher.lastName || '')}
                    </p>
                  </div>
                  <Button variant="danger" onClick={() => handleRemove(assignment.subject.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-700">No subjects assigned to this class yet.</p>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
