'use client'

import { useMemo, useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'
import { useTeacherUi } from '@/lib/use-teacher-ui'

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

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE'

const STATUS_OPTIONS: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE']

function statusButtonClass(active: boolean, status: AttendanceStatus) {
  if (!active) {
    return 'border border-(--border-subtle) bg-(--surface-card) ui-text-secondary'
  }
  if (status === 'PRESENT') {
    return 'border border-transparent bg-[#eafaf3] text-[#1b8a5a] font-semibold'
  }
  if (status === 'ABSENT') {
    return 'border border-transparent bg-[#fff0ee] text-[#c0392b] font-semibold'
  }
  return 'border border-transparent bg-[#fff8e6] text-[#b07d00] font-semibold'
}

export default function TeacherAttendancePage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { tTeacher, tCommon } = useTeacherUi()
  const t = (key: string, fallback: string) => tTeacher('attendance', key, fallback)

  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<{ [key: string]: string }>({})
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const statusLabels: Record<AttendanceStatus, string> = {
    PRESENT: t('presentBtn', 'Present'),
    ABSENT: t('absentBtn', 'Absent'),
    LATE: t('lateBtn', 'Late'),
  }

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

  const handleAttendanceChange = (studentId: string, nextStatus: string) => {
    setAttendance({ ...attendance, [studentId]: nextStatus })
  }

  const handleMarkAllPresent = () => {
    const allPresent: { [key: string]: string } = {}
    students.forEach((student) => {
      allPresent[student.id] = 'PRESENT'
    })
    setAttendance(allPresent)
  }

  const handleSaveAttendance = async () => {
    setIsSavingAttendance(true)
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
        showToast(t('attendanceSaved', 'Attendance saved successfully!'), 'success')
        fetchAttendance()
      } else {
        const error = await res.json()
        showToast(error.error || t('failedSave', 'Failed to save attendance'), 'error')
      }
    } catch (error) {
      console.error('Failed to save attendance:', error)
      showToast(t('failedSave', 'Failed to save attendance'), 'error')
    } finally {
      setIsSavingAttendance(false)
    }
  }

  const selectedClassName = useMemo(
    () => classes.find((cls) => cls.id === selectedClass)?.name || t('selectClass', 'Select Class'),
    [classes, selectedClass]
  )

  const markedCount = useMemo(
    () => students.filter((student) => Boolean(attendance[student.id])).length,
    [students, attendance]
  )

  const summaryText = t('summaryMarked', '{count} of {total} marked')
    .replace('{count}', String(markedCount))
    .replace('{total}', String(students.length))

  if (status === 'loading' || !session) {
    return <div>{tCommon('loading', 'Loading...')}</div>
  }

  const canSave = Boolean(selectedClass) && students.length > 0

  const filterControls = (
    <>
      <div>
        <label className="block text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary mb-1.5">
          {t('selectClass', 'Select Class')}
        </label>
        <Select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
          <option value="">{t('selectClass', 'Select Class')}</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="block text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary mb-1.5">
          {t('dateLabel', 'Date')}
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full min-h-11 px-3 py-2 rounded-[6px] border border-(--border-subtle) bg-(--surface-card) ui-text-primary"
        />
      </div>
    </>
  )

  const statusToggle = (studentId: string, size: 'mobile' | 'desktop') => (
    <div className={size === 'mobile' ? 'grid grid-cols-3 gap-2' : 'flex justify-end gap-2'}>
      {STATUS_OPTIONS.map((option) => {
        const active = attendance[studentId] === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => handleAttendanceChange(studentId, option)}
            className={`${
              size === 'mobile' ? 'min-h-11 text-sm' : 'h-8 px-3 text-[13px]'
            } rounded-[6px] transition-all duration-150 ease-in-out active:scale-[0.97] ${statusButtonClass(
              active,
              option
            )}`}
          >
            {statusLabels[option]}
          </button>
        )
      })}
    </div>
  )

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Teacher',
        role: 'Teacher',
        email: session.user.email,
      }}
      navItems={TEACHER_NAV_ITEMS}
    >
      <div className="space-y-4 pb-24 md:pb-0">
        <div>
          <h1 className="text-[20px] font-semibold ui-text-primary">{t('title', 'Attendance')}</h1>
          <p className="ui-text-secondary mt-1 text-sm">{t('subtitle', 'Mark student attendance')}</p>
        </div>

        {/* Mobile: compact filter chip + collapsible sheet */}
        <Card className="p-3 md:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className="flex w-full min-h-11 items-center justify-between gap-3 rounded-[6px] border border-(--border-subtle) bg-(--surface-soft) px-3 text-left transition-all duration-150"
            aria-expanded={filtersOpen}
          >
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.07em] ui-text-secondary">
                {t('filters', 'Filters')}
              </p>
              <p className="truncate text-sm font-medium ui-text-primary">
                {selectedClassName}
                <span className="ui-text-secondary font-normal"> · {selectedDate}</span>
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium" style={{ color: '#635bff' }}>
              {filtersOpen ? t('hideFilters', 'Hide filters') : t('editFilters', 'Edit filters')} →
            </span>
          </button>

          {filtersOpen && (
            <div className="mt-3 space-y-3 border-t border-(--border-subtle) pt-3">
              {filterControls}
              <Button
                variant="secondary"
                onClick={handleMarkAllPresent}
                disabled={!canSave}
                className="w-full min-h-11"
              >
                {t('markAllPresent', 'Mark All Present')}
              </Button>
            </div>
          )}

          {students.length > 0 && (
            <p className="mt-3 text-xs ui-text-secondary">{summaryText}</p>
          )}
        </Card>

        {/* Desktop filters */}
        <Card className="hidden p-5 md:block">
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {filterControls}
            <div className="flex items-end justify-end gap-2">
              <Button variant="secondary" onClick={handleMarkAllPresent} disabled={!canSave}>
                {t('markAllPresent', 'Mark All Present')}
              </Button>
              <Button onClick={handleSaveAttendance} isLoading={isSavingAttendance} disabled={!canSave}>
                {t('saveAttendance', 'Save Attendance')}
              </Button>
            </div>
          </div>

          {loading ? (
            <div>{tCommon('loading', 'Loading...')}</div>
          ) : selectedClass && students.length > 0 ? (
            <div className="overflow-x-auto ui-table-wrap">
              <table className="ui-table min-w-full">
                <thead>
                  <tr>
                    <th>{t('admissionNoCol', 'Admission No')}</th>
                    <th>{t('studentNameCol', 'Student Name')}</th>
                    <th>{t('statusCol', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-(--surface-soft)">
                      <td>{student.admissionNumber}</td>
                      <td>
                        {student.firstName} {student.lastName}
                      </td>
                      <td>{statusToggle(student.id, 'desktop')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedClass ? (
            <div className="py-8 text-center ui-text-secondary">
              {t('noStudentsInClass', 'No students in this class')}
            </div>
          ) : (
            <div className="text-center ui-text-secondary">
              {t('pleaseSelectClass', 'Please select a class')}
            </div>
          )}
        </Card>

        {/* Mobile: card list */}
        <div className="md:hidden">
          {loading ? (
            <Card className="p-6 text-center ui-text-secondary">{tCommon('loading', 'Loading...')}</Card>
          ) : selectedClass && students.length > 0 ? (
            <div className="space-y-3">
              {students.map((student) => (
                <Card key={student.id} className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold ui-text-primary">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-[0.07em] ui-text-secondary">
                        {student.admissionNumber}
                      </p>
                    </div>
                  </div>
                  {statusToggle(student.id, 'mobile')}
                </Card>
              ))}
            </div>
          ) : selectedClass ? (
            <Card className="p-8 text-center ui-text-secondary">
              {t('noStudentsInClass', 'No students in this class')}
            </Card>
          ) : (
            <Card className="p-8 text-center ui-text-secondary">
              {t('pleaseSelectClass', 'Please select a class')}
            </Card>
          )}
        </div>

        {/* Mobile sticky primary CTA */}
        {canSave && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-(--border-subtle) bg-(--surface-card) p-3 md:hidden safe-area-pb">
            <Button
              onClick={handleSaveAttendance}
              isLoading={isSavingAttendance}
              disabled={!canSave}
              className="w-full min-h-11"
            >
              {t('saveAttendance', 'Save Attendance')}
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
