'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

interface Student {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string
}

interface Attendance {
  id: string
  date: string
  status: string
  student?: Student
}

export default function ParentAttendancePage() {
  const { data: session, status } = useSession()
  const [children, setChildren] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [selectedChild, setSelectedChild] = useState('')
  const [loading, setLoading] = useState(true)
  const [attendanceLoading, setAttendanceLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'PARENT') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session) {
      fetchChildren()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    if (selectedChild) {
      setAttendanceLoading(true)
      const fetchAttendanceData = async () => {
        try {
          const res = await fetch(`/api/attendance?studentId=${selectedChild}`)
          if (res.ok) {
            const data = await res.json()
            setAttendance(Array.isArray(data.attendance) ? data.attendance : [])
          } else {
            setAttendance([])
          }
        } catch (error) {
          console.error('Failed to fetch attendance:', error)
          setAttendance([])
        } finally {
          setAttendanceLoading(false)
        }
      }
      fetchAttendanceData()
    }
  }, [selectedChild])

  const fetchChildren = async () => {
    try {
      const res = await fetch('/api/students?parentId=' + session?.user?.id)
      if (res.ok) {
        const data = await res.json()
        const childrenArray = Array.isArray(data.students) ? data.students : []
        setChildren(childrenArray)
        if (childrenArray.length > 0) {
          setSelectedChild(childrenArray[0].id)
        }
      } else {
        setChildren([])
      }
    } catch (error) {
      console.error('Failed to fetch children:', error)
      setChildren([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return { bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' }
      case 'ABSENT':
        return { bg: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' }
      case 'LATE':
        return { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' }
      default:
        return { bg: 'bg-slate-500', light: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500' }
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    }
  }

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = [
    { label: 'Dashboard', href: '/parent/dashboard', icon: '🏠' },
    { label: 'Attendance', href: '/parent/attendance', icon: '📅' },
    { label: 'Results', href: '/parent/results', icon: '📊' },
    { label: 'Messages', href: '/parent/messages', icon: '💬' },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Parent',
        role: 'Parent',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="min-h-screen bg-linear-to-b from-emerald-50 via-white to-blue-50">
        <div className="mx-auto w-full max-w-md space-y-5 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] px-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Attendance Records
            </p>
            <div className="mt-4">
              <label className="block text-sm font-semibold text-slate-900 mb-3">Select Child</label>
              <Select
                value={selectedChild}
                onChange={(e) => setSelectedChild(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Child</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.firstName} {child.lastName} ({child.admissionNumber})
                  </option>
                ))}
              </Select>
            </div>
          </section>

          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl bg-linear-to-r from-slate-100 to-slate-200 h-20 animate-pulse"></div>
                ))}
              </div>
            </section>
          ) : attendanceLoading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl bg-linear-to-r from-slate-100 to-slate-200 h-20 animate-pulse"></div>
                ))}
              </div>
            </section>
          ) : selectedChild && attendance.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Attendance History
                </h2>
                <span className="rounded-full bg-linear-to-r from-slate-100 to-slate-50 px-3 py-1 text-xs text-slate-500 border border-slate-200">
                  {attendance.length} records
                </span>
              </div>
              <div className="space-y-3">
                {attendance.map((record) => {
                  const { date, time } = formatDateTime(record.date)
                  const colors = getStatusColor(record.status)
                  return (
                    <div
                      key={record.id}
                      className="rounded-2xl border border-slate-200 bg-linear-to-br from-white to-slate-50 p-4 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`h-3 w-3 rounded-full ${colors.dot}`}></span>
                            <p className="text-sm font-semibold text-slate-900">{date}</p>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">📍 Time: {time}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${colors.light} ${colors.text} border-current`}>
                          {record.status}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : selectedChild ? (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-linear-to-br from-slate-50 to-slate-100 p-6 text-center">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-sm text-slate-600">No attendance records found for this child</p>
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-linear-to-br from-slate-50 to-slate-100 p-6 text-center">
              <div className="text-4xl mb-2">👋</div>
              <p className="text-sm text-slate-600">Please select a child to view attendance</p>
            </section>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
