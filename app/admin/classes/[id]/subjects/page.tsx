'use client'

import { useCallback, useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect, useParams } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { useConfirmDialog } from '@/lib/useConfirmDialog'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import { useAdminUi } from '@/lib/use-admin-ui'

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
  const { confirm } = useConfirmDialog()
  const { tAdmin, tCommon } = useAdminUi()
  const params = useParams<{ id: string }>()
  const classId = params?.id

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removingSubjectId, setRemovingSubjectId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    subjectIds: [] as string[],
    teacherId: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN' && session?.user?.role !== 'DEPUTY_ADMIN') {
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
      showToast(tAdmin('failedLoadClassSubjects', 'Failed to load class subject assignments'), 'error')
    } finally {
      setLoading(false)
    }
  }, [classId, showToast, tAdmin])

  useEffect(() => {
    if (session && classId) {
      fetchData()
    }
  }, [session, classId, fetchData])

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!classId || formData.subjectIds.length === 0 || !formData.teacherId) {
      showToast(
        tAdmin('selectSubjectsAndTeacher', 'Please select one or more subjects and a teacher'),
        'warning'
      )
      return
    }

    try {
      setSaving(true)
      const res = await fetch(`/api/classes/${classId}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectIds: formData.subjectIds,
          teacherId: formData.teacherId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || tAdmin('failedAssignSubject', 'Failed to assign subject'), 'error')
        return
      }

      setFormData({ subjectIds: [], teacherId: '' })
      const assignedCount = typeof data.count === 'number' ? data.count : formData.subjectIds.length
      showToast(
        tAdmin('assignmentsSaved', '{n} subject assignment(s) saved').replace(
          '{n}',
          String(assignedCount)
        ),
        'success'
      )
      await fetchData()
    } catch (error) {
      console.error('Failed to assign subject:', error)
      showToast(tAdmin('failedAssignSubject', 'Failed to assign subject'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (subjectId: string) => {
    if (!classId || removingSubjectId) return

    const assignment = assignments.find((item) => item.subject.id === subjectId)
    const isConfirmed = await confirm({
      title: tAdmin('removeAssignmentTitle', 'Remove Assignment'),
      description: tAdmin(
        'confirmRemoveAssignment',
        'Remove this subject assignment from class?'
      ),
      variant: 'danger',
      confirmLabel: tAdmin('remove', 'Remove'),
      cancelLabel: tCommon('cancel', 'Cancel'),
      loadingLabel: tAdmin('removing', 'Removing...'),
      entity: assignment
        ? {
            name: assignment.subject.name,
            subtitle: `${assignment.teacher.firstName || ''} ${assignment.teacher.lastName || ''}`.trim(),
          }
        : undefined,
      allowBackdropClose: false,
      allowEscapeClose: false,
    })

    if (!isConfirmed) return

    const previousAssignments = assignments
    // Immediate paint: disable button + optimistic remove before network work
    setRemovingSubjectId(subjectId)
    setAssignments((prev) => prev.filter((item) => item.subject.id !== subjectId))

    try {
      const res = await fetch(
        `/api/classes/${classId}/subjects?subjectId=${encodeURIComponent(subjectId)}`,
        { method: 'DELETE' }
      )

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setAssignments(previousAssignments)
        showToast(
          data.error || tAdmin('failedRemoveAssignment', 'Failed to remove assignment'),
          'error'
        )
        return
      }

      showToast(tAdmin('assignmentRemoved', 'Subject assignment removed'), 'success')
    } catch (error) {
      console.error('Failed to remove assignment:', error)
      setAssignments(previousAssignments)
      showToast(tAdmin('failedRemoveAssignment', 'Failed to remove assignment'), 'error')
    } finally {
      setRemovingSubjectId(null)
    }
  }

  const handleSubjectToggle = (subjectId: string) => {
    setFormData((prev) => {
      const selected = prev.subjectIds.includes(subjectId)
      return {
        ...prev,
        subjectIds: selected
          ? prev.subjectIds.filter((id) => id !== subjectId)
          : [...prev.subjectIds, subjectId],
      }
    })
  }

  if (status === 'loading' || !session) {
    return <div>{tCommon('loading', 'Loading...')}</div>
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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {tAdmin('classSubjectAssignment', 'Class Subject Assignment')}
            </h1>
            <p className="text-gray-600 mt-2">
              {tAdmin('classColon', 'Class:')}{' '}
              <span className="font-semibold">
                {classDetails?.name || tCommon('loading', 'Loading...')}
              </span>
            </p>
          </div>
          <a
            href="/admin/classes"
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            {tAdmin('backToClasses', '← Back to Classes')}
          </a>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {tAdmin('assignSubjectsToClass', 'Assign Subjects to Class')}
          </h2>
          <form onSubmit={handleAssign} noValidate className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{tAdmin('subjects', 'Subjects')}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto rounded-md border border-(--border-subtle) p-3 bg-white">
                {subjects.map((subject) => {
                  const checked = formData.subjectIds.includes(subject.id)
                  return (
                    <label key={subject.id} className="flex items-center gap-2 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleSubjectToggle(subject.id)}
                        className="h-4 w-4"
                      />
                      <span>{subject.name}{subject.code ? ` (${subject.code})` : ''}</span>
                    </label>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-gray-600">
                {tAdmin('selectedCount', 'Selected: {n}').replace(
                  '{n}',
                  String(formData.subjectIds.length)
                )}
              </p>
            </div>

            <Select
              label={tAdmin('teacher', 'Teacher')}
              value={formData.teacherId}
              onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
              className="text-gray-900 bg-white"
            >
              <option value="">{tAdmin('selectTeacher', 'Select teacher')}</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.firstName} {teacher.lastName}
                </option>
              ))}
            </Select>

            <div className="flex justify-end">
              <Button type="submit" isLoading={saving}>
                {tAdmin('saveAssignments', 'Save Assignments')}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {tAdmin('assignedSubjects', 'Assigned Subjects')}
          </h2>
          {loading ? (
            <div>{tAdmin('loadingAssignments', 'Loading assignments...')}</div>
          ) : assignments.length > 0 ? (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between rounded-lg border border-(--border-subtle) bg-(--surface-soft) p-4"
                >
                  <div>
                    <p className="font-semibold ui-text-primary">{assignment.subject.name}</p>
                    <p className="text-sm ui-text-secondary">
                      {tAdmin('teacherColonName', 'Teacher: {name}').replace(
                        '{name}',
                        `${assignment.teacher.firstName || ''} ${assignment.teacher.lastName || ''}`.trim()
                      )}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    onClick={() => handleRemove(assignment.subject.id)}
                    isLoading={removingSubjectId === assignment.subject.id}
                    disabled={removingSubjectId !== null}
                  >
                    {tAdmin('remove', 'Remove')}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-700">
              {tAdmin('noSubjectsAssignedYet', 'No subjects assigned to this class yet.')}
            </p>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
