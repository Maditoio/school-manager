'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCheck, Save } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

interface Student {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string
  class?: { name: string }
}

interface Attendance {
  id: string
  studentId: string
  date: string
  status: string
  student?: Student
}

interface Class {
  id: string
  name: string
}

export default function AttendancePage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<{ [key: string]: string }>({})
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [tableSearch, setTableSearch] = useState('')
  const [tablePage, setTablePage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/classes')
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
  }, [])

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

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance?date=${selectedDate}&classId=${selectedClass}`)
      if (res.ok) {
        const data = await res.json()
        const attendanceArray = Array.isArray(data.attendance) ? data.attendance : []
        const attendanceMap: { [key: string]: string } = {}
        attendanceArray.forEach((record: Attendance) => {
          attendanceMap[record.studentId] = record.status
        })
        setAttendance(attendanceMap)
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error)
    }
  }, [selectedClass, selectedDate])

  useEffect(() => {
    if (session) {
      fetchClasses()
    }
  }, [fetchClasses, session])

  useEffect(() => {
    if (selectedClass) {
      fetchStudents()
      fetchAttendance()
    }
  }, [fetchAttendance, fetchStudents, selectedClass])

  const handleAttendanceChange = useCallback((studentId: string, status: string) => {
    setAttendance({ ...attendance, [studentId]: status })
  }, [attendance])

  const handleMarkAllPresent = useCallback(() => {
    const allPresent: { [key: string]: string } = {}
    students.forEach((student) => { allPresent[student.id] = 'PRESENT' })
    setAttendance(allPresent)
  }, [students])

  const handleSaveAttendance = async () => {
    try {
      const records = students.map((student) => ({
        studentId: student.id,
        date: selectedDate,
        status: attendance[student.id] || 'ABSENT',
      }))

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      })

      if (res.ok) {
        showToast('Attendance saved successfully!', 'success')
        fetchAttendance()
      } else {
        const error = await res.json()
        showToast(error.error || 'Failed to save attendance', 'error')
      }
    } catch (error) {
      console.error('Failed to save attendance:', error)
      showToast('Failed to save attendance', 'error')
    }
  }

  const filteredStudents = useMemo(() => {
    const query = tableSearch.trim().toLowerCase()
    if (!query) return students

    return students.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase()
      return (
        fullName.includes(query) ||
        String(student.admissionNumber || '')
          .toLowerCase()
          .includes(query)
      )
    })
  }, [students, tableSearch])

  const paginatedStudents = useMemo(() => {
    const start = (tablePage - 1) * pageSize
    return filteredStudents.slice(start, start + pageSize)
  }, [filteredStudents, tablePage])

  const attendanceColumns = useMemo(
    () => [
      {
        key: 'admissionNumber',
        label: 'Admission No',
        sortable: true,
      },
      {
        key: 'student',
        label: 'Student',
        sortable: true,
        renderCell: (student: Student) => {
          const initials = `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase() || 'S'
          return (
            <div className="flex items-center gap-3">
              <div className="ui-table-avatar">{initials}</div>
              <div className="flex flex-col">
                <span className="font-medium ui-text-primary">
                  {student.firstName} {student.lastName}
                </span>
                <span className="text-xs ui-text-secondary">{student.class?.name || 'No class assigned'}</span>
              </div>
            </div>
          )
        },
      },
      {
        key: 'status',
        label: 'Status',
        renderCell: (student: Student) => (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant={attendance[student.id] === 'PRESENT' ? 'primary' : 'ghost'}
              onClick={() => handleAttendanceChange(student.id, 'PRESENT')}
            >
              Present
            </Button>
            <Button
              type="button"
              size="sm"
              variant={attendance[student.id] === 'ABSENT' ? 'danger' : 'ghost'}
              onClick={() => handleAttendanceChange(student.id, 'ABSENT')}
            >
              Absent
            </Button>
            <Button
              type="button"
              size="sm"
              variant={attendance[student.id] === 'LATE' ? 'secondary' : 'ghost'}
              onClick={() => handleAttendanceChange(student.id, 'LATE')}
            >
              Late
            </Button>
          </div>
        ),
      },
    ],
    [attendance, handleAttendanceChange]
  )

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = ADMIN_NAV_ITEMS

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Attendance Management</h1>
            <p className="text-gray-600 mt-2">Mark and manage student attendance</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="inline-flex items-center gap-1.5"
              onClick={handleMarkAllPresent}
              disabled={students.length === 0}
            >
              <CheckCheck className="h-4 w-4" />
              Mark All Present
            </Button>
            <Button className="inline-flex items-center gap-1.5" onClick={handleSaveAttendance}>
              <Save className="h-4 w-4" />
              Save Attendance
            </Button>
          </div>
        </div>

        <Table
          title="Attendance Records"
          columns={attendanceColumns}
          data={paginatedStudents}
          loading={loading}
          totalCount={filteredStudents.length}
          page={tablePage}
          pageSize={pageSize}
          onSearch={setTableSearch}
          onPageChange={setTablePage}
          headerControls={
            <label className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value)
                  setTablePage(1)
                }}
                className="ui-input h-8 rounded-lg px-2.5 text-[12px]"
                style={{ minHeight: '2rem', paddingTop: 0, paddingBottom: 0 }}
                aria-label="Filter attendance by date"
              />
            </label>
          }
          filterLabel="Class"
          filterOptions={[
            { value: '', label: 'All classes' },
            ...classes.map((cls) => ({ value: cls.id, label: cls.name })),
          ]}
          activeFilter={selectedClass}
          onFilterChange={(value: string) => {
            setSelectedClass(value)
            setTablePage(1)
          }}
          emptyMessage={selectedClass ? 'No students in this class' : 'No students found.'}
          rowKey="id"
        />
      </div>
    </DashboardLayout>
  )
}
