'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Minus } from 'lucide-react'
import { useConfirmDialog } from '@/lib/useConfirmDialog'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

interface Student {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string | null
  class?: {
    id: string
    name: string
  }
}

interface ClassOption {
  id: string
  name: string
  academicYear: number
  grade: string | null
}

export default function ClassStudentsPage() {
  const params = useParams<{ id: string }>()
  const classId = params?.id

  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { confirm } = useConfirmDialog()

  const [assigned, setAssigned] = useState<Student[]>([])
  const [available, setAvailable] = useState<Student[]>([])
  const [selectedAvailableIds, setSelectedAvailableIds] = useState<string[]>([])
  const [selectedAssignedIds, setSelectedAssignedIds] = useState<string[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [targetClassId, setTargetClassId] = useState('')
  const [assignedSearch, setAssignedSearch] = useState('')
  const [availableSearch, setAvailableSearch] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [addingStudents, setAddingStudents] = useState(false)
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN' && session?.user?.role !== 'DEPUTY_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      const [assignedRes, availableRes, classesRes] = await Promise.all([
        fetch(`/api/classes/${classId}/students`),
        fetch(`/api/classes/${classId}/students?available=true`),
        fetch('/api/classes'),
      ])

      if (assignedRes.ok) {
        const data = await assignedRes.json()
        setAssigned(Array.isArray(data.students) ? data.students : [])
      } else {
        setAssigned([])
      }

      if (availableRes.ok) {
        const data = await availableRes.json()
        setAvailable(Array.isArray(data.students) ? data.students : [])
      } else {
        setAvailable([])
      }

      if (classesRes.ok) {
        const data = await classesRes.json()
        const allClasses = Array.isArray(data.classes) ? data.classes : []
        setClasses(
          allClasses
            .filter((classItem: ClassOption) => classItem.id !== classId)
            .map((classItem: ClassOption) => ({
              id: classItem.id,
              name: classItem.name,
              academicYear: classItem.academicYear,
              grade: classItem.grade ?? null,
            }))
        )
      } else {
        setClasses([])
      }
    } catch (error) {
      console.error('Failed to fetch class students:', error)
      showToast('Failed to load class students', 'error')
      setAssigned([])
      setAvailable([])
      setClasses([])
    } finally {
      setLoading(false)
    }
  }, [classId, showToast])

  useEffect(() => {
    if (classId && session?.user?.role === 'SCHOOL_ADMIN') {
      fetchData()
    }
  }, [classId, session, fetchData])

  const toggleAvailableSelect = (studentId: string) => {
    setSelectedAvailableIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    )
  }

  const toggleAssignedSelect = (studentId: string) => {
    setSelectedAssignedIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    )
  }

  const selectAllAssigned = () => {
    setSelectedAssignedIds(filteredAssigned.map((student) => student.id))
  }

  const clearAssignedSelection = () => {
    setSelectedAssignedIds([])
  }

  const addSelectedStudents = async () => {
    if (selectedAvailableIds.length === 0) {
      showToast('Select students to add', 'warning')
      return
    }

    try {
      setAddingStudents(true)
      const res = await fetch(`/api/classes/${classId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: selectedAvailableIds }),
      })

      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to add students', 'error')
        return
      }

      setSelectedAvailableIds([])
      await fetchData()
      showToast('Students added to class', 'success')
    } catch (error) {
      console.error('Failed to add students:', error)
      showToast('Failed to add students', 'error')
    } finally {
      setAddingStudents(false)
    }
  }

  const transferSelectedStudents = async () => {
    if (!targetClassId) {
      showToast('Select the target class first', 'warning')
      return
    }

    if (selectedAssignedIds.length === 0) {
      showToast('Select students to move', 'warning')
      return
    }

    const isConfirmed = await confirm({
      title: 'Move Selected Students',
      description:
        'This will move the selected students to the target class and update their class assignment history. This action cannot be undone from here.',
      variant: 'warning',
      confirmLabel: `Move ${selectedAssignedIds.length} Student${selectedAssignedIds.length === 1 ? '' : 's'}`,
      cancelLabel: 'Cancel',
      loadingLabel: 'Moving...',
      entity: {
        name: `${selectedAssignedIds.length} selected student${selectedAssignedIds.length === 1 ? '' : 's'}`,
        subtitle: classes.find((classItem) => classItem.id === targetClassId)
          ? `Target: ${classes.find((classItem) => classItem.id === targetClassId)?.name}`
          : 'Target class selected',
      },
      allowBackdropClose: false,
      allowEscapeClose: false,
    })

    if (!isConfirmed) return

    try {
      setTransferring(true)
      const res = await fetch(`/api/classes/${classId}/students/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetClassId,
          studentIds: selectedAssignedIds,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to move students', 'error')
        return
      }

      setSelectedAssignedIds([])
      await fetchData()
      showToast('Students moved successfully', 'success')
    } catch (error) {
      console.error('Failed to move students:', error)
      showToast('Failed to move students', 'error')
    } finally {
      setTransferring(false)
    }
  }

  const removeStudentFromClass = async (student: Student) => {
    const isConfirmed = await confirm({
      title: 'Remove from Class',
      description:
        `This will remove ${student.firstName} ${student.lastName} from this class and place the student in the Unassigned class for this academic year. This action cannot be undone directly.`,
      variant: 'danger',
      confirmLabel: 'Yes, Remove',
      cancelLabel: 'Cancel',
      loadingLabel: 'Removing...',
      entity: {
        name: `${student.firstName} ${student.lastName}`,
        subtitle: `${student.admissionNumber || 'No admission number'}`,
      },
      allowBackdropClose: false,
      allowEscapeClose: false,
    })

    if (!isConfirmed) return

    try {
      setRemovingStudentId(student.id)
      const res = await fetch(`/api/classes/${classId}/students`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        showToast(data.error || 'Failed to remove student from class', 'error')
        return
      }

      setSelectedAssignedIds((prev) => prev.filter((id) => id !== student.id))
      await fetchData()
      showToast('Student removed from class', 'success')
    } catch (error) {
      console.error('Failed to remove student from class:', error)
      showToast('Failed to remove student from class', 'error')
    } finally {
      setRemovingStudentId(null)
    }
  }

  const canMoveSelected = !!targetClassId && selectedAssignedIds.length > 0 && !transferring

  const navItems = session?.user?.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS

  const filteredAssigned = useMemo(() => {
    const query = assignedSearch.trim().toLowerCase()
    if (!query) return assigned

    return assigned.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase()
      const admission = (student.admissionNumber || '').toLowerCase()
      return fullName.includes(query) || admission.includes(query)
    })
  }, [assigned, assignedSearch])

  const filteredAvailable = useMemo(() => {
    const query = availableSearch.trim().toLowerCase()
    if (!query) return available

    return available.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase()
      const admission = (student.admissionNumber || '').toLowerCase()
      return fullName.includes(query) || admission.includes(query)
    })
  }, [available, availableSearch])

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold ui-text-primary">Class Students</h1>
            <p className="ui-text-secondary mt-2">Add or move students for this class enrollment</p>
          </div>
          <a
            href="/admin/classes"
            className="px-4 py-2 text-sm rounded border border-(--border-subtle) bg-(--surface-soft) ui-text-secondary hover:ui-text-primary transition-colors"
          >
            Back to Classes
          </a>
        </div>

        {loading ? (
          <div>Loading class students...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold ui-text-primary mb-4">Enrolled Students ({assigned.length})</h2>
              <div className="mb-3 space-y-2">
                <div className="flex gap-2">
                  <Button onClick={selectAllAssigned} className="text-sm">
                    Select All Visible
                  </Button>
                  <Button variant="secondary" onClick={clearAssignedSelection} className="text-sm">
                    Clear Selection
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    className="w-full px-3 py-2 border border-(--border-subtle) rounded-lg bg-(--surface) ui-text-primary"
                  >
                    <option value="">Select target class</option>
                    {classes.map((classItem) => (
                      <option key={classItem.id} value={classItem.id}>
                        {classItem.name}
                        {classItem.grade ? ` • ${classItem.grade}` : ''}
                        {` • ${classItem.academicYear}`}
                      </option>
                    ))}
                  </select>
                  <Button onClick={transferSelectedStudents} disabled={!canMoveSelected} className="whitespace-nowrap">
                    {transferring
                      ? 'Moving...'
                      : `Move Selected (${selectedAssignedIds.length})`}
                  </Button>
                </div>
              </div>
              <input
                type="text"
                value={assignedSearch}
                onChange={(e) => setAssignedSearch(e.target.value)}
                placeholder="Search by student name or admission number"
                className="w-full mb-3 px-3 py-2 border border-(--border-subtle) rounded-lg bg-(--surface) ui-text-primary"
              />
              <div className="space-y-3 max-h-112 overflow-auto">
                {filteredAssigned.length > 0 ? (
                  filteredAssigned.map((student) => (
                    <div key={student.id} className="flex items-center justify-between border border-(--border-subtle) bg-(--surface-soft) rounded-lg p-3">
                      <label className="flex items-center gap-3 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAssignedIds.includes(student.id)}
                          onChange={() => toggleAssignedSelect(student.id)}
                        />
                        <div>
                          <p className="font-medium ui-text-primary">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs ui-text-secondary">{student.admissionNumber || 'No admission number'}</p>
                        </div>
                      </label>

                      <button
                        type="button"
                        aria-label={`Remove ${student.firstName} ${student.lastName} from class`}
                        title="Remove from class"
                        onClick={() => removeStudentFromClass(student)}
                        disabled={removingStudentId === student.id}
                        className="ml-3 inline-flex h-6 w-6 items-center justify-center ui-text-secondary hover:ui-text-primary disabled:opacity-50"
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm ui-text-secondary">No students enrolled in this class yet.</p>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold ui-text-primary mb-4">Available Students ({available.length})</h2>
              <input
                type="text"
                value={availableSearch}
                onChange={(e) => setAvailableSearch(e.target.value)}
                placeholder="Search by student name or admission number"
                className="w-full mb-3 px-3 py-2 border border-(--border-subtle) rounded-lg bg-(--surface) ui-text-primary"
              />
              <div className="space-y-3 max-h-88 overflow-auto">
                {filteredAvailable.length > 0 ? (
                  filteredAvailable.map((student) => (
                    <label key={student.id} className="flex items-center justify-between rounded-lg border border-(--border-subtle) bg-(--surface-soft) p-3 hover:bg-(--surface)">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedAvailableIds.includes(student.id)}
                          onChange={() => toggleAvailableSelect(student.id)}
                        />
                        <div>
                          <p className="font-medium ui-text-primary">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs ui-text-secondary">
                            {student.admissionNumber || 'No admission number'}
                            {student.class?.name ? ` • Primary: ${student.class.name}` : ''}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))
                ) : (
                  <p className="text-sm ui-text-secondary">No available students to add.</p>
                )}
              </div>

              <div className="mt-4">
                <Button onClick={addSelectedStudents} isLoading={addingStudents} disabled={selectedAvailableIds.length === 0}>
                  Add Selected Students ({selectedAvailableIds.length})
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
