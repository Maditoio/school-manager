'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

interface Student {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string
}

interface Class {
  id: string
  name: string
}

interface Attendance {
  id: string
  studentId: string
  status: string
}

export default function TeacherAttendancePage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<{ [key: string]: string }>({})
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'TEACHER') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session) {
      fetchClasses()
    }
  }, [session])

  useEffect(() => {
    if (selectedClass) {
      fetchStudents()
      fetchAttendance()
    }
  }, [selectedClass, selectedDate])

  const fetchClasses = async () => {
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
  }

  const fetchStudents = async () => {
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
  }

  const fetchAttendance = async () => {
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
      } else {
        setAttendance({})
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error)
      setAttendance({})
    }
  }

  const handleAttendanceChange = (studentId: string, status: string) => {
    setAttendance({ ...attendance, [studentId]: status })
  }

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

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = [
    { label: 'Dashboard', href: '/teacher/dashboard', icon: '📊' },
    { label: 'My Classes', href: '/teacher/classes', icon: '🏫' },
    { label: 'Students', href: '/teacher/students', icon: '👨‍🎓' },
    { label: 'Assessments', href: '/teacher/assessments', icon: '📋' },
    { label: 'Attendance', href: '/teacher/attendance', icon: '📅' },
    { label: 'Results', href: '/teacher/results', icon: '📝' },
    { label: 'Announcements', href: '/teacher/announcements', icon: '📢' },
    { label: 'Messages', href: '/teacher/messages', icon: '💬' },
  ]

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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-700 mt-2">Mark student attendance</p>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">Select Class</label>
              <Select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="">Select Class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
              />
            </div>
            <div className="flex items-end justify-end">
              <Button onClick={handleSaveAttendance}>
                Save Attendance
              </Button>
            </div>
          </div>

          {loading ? (
            <div>Loading...</div>
          ) : selectedClass && students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Admission No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Student Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.admissionNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.firstName} {student.lastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedClass ? (
            <div className="text-center text-gray-700 py-8">No students in this class</div>
          ) : (
            <div className="text-center text-gray-700">Please select a class</div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
