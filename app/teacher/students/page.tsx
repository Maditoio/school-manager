'use client'

import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Select } from '@/components/ui/Form'
import Table from '@/components/ui/Table'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'

interface Student {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string
  dateOfBirth: string
  gender: string
  class?: { name: string }
}

interface Class {
  id: string
  name: string
}

export default function TeacherStudentsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'TEACHER') {
      redirect('/login')
    }
  }, [session, status])

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/classes?teacherId=' + session?.user?.id)
      if (res.ok) {
        const data = await res.json()
        const classesArray = Array.isArray(data.classes) ? data.classes : []
        setClasses(classesArray)
        if (classesArray.length > 0) {
          setSelectedClass(classesArray[0].id)
        }
      } else {
        setClasses([])
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error)
      setClasses([])
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  const fetchStudents = useCallback(async () => {
    try {
      setStudentsLoading(true)
      const res = await fetch(`/api/students?classId=${selectedClass}`)
      if (res.ok) {
        const data = await res.json()
        setStudents(Array.isArray(data.students) ? data.students : [])
      } else {
        setStudents([])
      }
    } catch (error) {
      console.error('Failed to fetch students:', error)
      setStudents([])
    } finally {
      setStudentsLoading(false)
    }
  }, [selectedClass])

  useEffect(() => {
    if (session) {
      fetchClasses()
    }
  }, [session, fetchClasses])

  useEffect(() => {
    if (selectedClass) {
      fetchStudents()
    }
  }, [selectedClass, fetchStudents])

  if (status === 'loading' || !session) {
    return <div className="p-6 text-sm ui-text-secondary">Loading...</div>
  }

  const columns = [
    {
      key: 'admissionNumber',
      label: 'Admission No',
      sortable: true,
      renderCell: (s: Student) => (
        <span className="font-semibold ui-text-primary">{s.admissionNumber}</span>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      renderCell: (s: Student) => (
        <span className="font-medium ui-text-primary">
          {s.firstName} {s.lastName}
        </span>
      ),
    },
    { key: 'gender', label: 'Gender' },
    {
      key: 'dateOfBirth',
      label: 'Date of Birth',
      sortable: true,
      renderCell: (s: Student) =>
        s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : '—',
    },
    { key: 'actions', label: 'Actions' },
  ]

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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[1.25rem] font-semibold ui-text-primary">My Students</h1>
            <p className="mt-1 text-sm ui-text-secondary">Students in your classes</p>
          </div>
          <label className="flex min-w-[200px] flex-col gap-1">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
              Class
            </span>
            <Select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              options={classes.map((cls) => ({ value: cls.id, label: cls.name }))}
            />
          </label>
        </div>

        {selectedClass ? (
          <Table
            title="Students"
            columns={columns}
            data={students}
            loading={loading || studentsLoading}
            emptyMessage="No students in this class"
            rowKey="id"
            searchPlaceholder="Search students…"
            onRowClick={(s: Student) => router.push(`/teacher/students/${s.id}`)}
            getRowActions={(s: Student) => [
              {
                label: 'View',
                onClick: () => router.push(`/teacher/students/${s.id}`),
              },
            ]}
          />
        ) : (
          <div className="rounded-[10px] border border-(--border-subtle) bg-(--surface) p-8 text-center text-sm ui-text-secondary">
            Select a class to view students.
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
