'use client'

import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
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

  const viewStudentDetails = (studentId: string) => {
    router.push(`/teacher/students/${studentId}`)
  }

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
    return <div>Loading...</div>
  }

  const columns = [
    { key: 'admissionNumber', label: 'Admission No', sortable: true },
    {
      key: 'name',
      label: 'Name',
      sortable: false,
      renderCell: (s: Student) => `${s.firstName} ${s.lastName}`,
    },
    { key: 'gender', label: 'Gender' },
    {
      key: 'dateOfBirth',
      label: 'Date of Birth',
      sortable: true,
      renderCell: (s: Student) => new Date(s.dateOfBirth).toLocaleDateString(),
    },
    {
      key: 'view',
      label: '',
      renderCell: (s: Student) => (
        <button
          type="button"
          onClick={() => viewStudentDetails(s.id)}
          className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
        >
          View
        </button>
      ),
    },
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Students</h1>
          <p className="text-gray-500 mt-1">Students in your classes</p>
        </div>

        <Card className="p-4">
          <div className="mb-4">
            <Select
              label="Select Class"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              options={classes.map((cls) => ({ value: cls.id, label: cls.name }))}
            />
          </div>
        </Card>

        {selectedClass && (
          <Table
            title="Students"
            columns={columns}
            data={students}
            loading={loading}
            emptyMessage="No students in this class"
            rowKey="id"
          />
        )}
      </div>
    </DashboardLayout>
  )
}
