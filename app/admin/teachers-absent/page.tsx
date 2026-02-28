'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import Table from '@/components/ui/Table'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'

type TeacherAbsentRow = {
  id: string
  startDate: string
  endDate: string
  reason: string | null
  teacher?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  }
}

function formatName(row: TeacherAbsentRow) {
  const first = row.teacher?.firstName?.trim() || ''
  const last = row.teacher?.lastName?.trim() || ''
  const full = `${first} ${last}`.trim()
  return full || row.teacher?.email || 'Unknown Teacher'
}

export default function TeachersAbsentPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [rows, setRows] = useState<TeacherAbsentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }

    if (session?.user?.role !== 'SCHOOL_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  const fetchAbsentTeachers = useCallback(async (date: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/teacher-off-days?activeOn=${encodeURIComponent(date)}`, {
        cache: 'no-store',
      })

      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        showToast(payload.error || 'Failed to fetch absent teachers', 'error')
        setRows([])
        return
      }

      setRows(Array.isArray(payload.offDays) ? payload.offDays : [])
    } catch (error) {
      console.error('Failed to fetch absent teachers:', error)
      showToast('Failed to fetch absent teachers', 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (session?.user?.role === 'SCHOOL_ADMIN') {
      fetchAbsentTeachers(selectedDate)
    }
  }, [fetchAbsentTeachers, selectedDate, session])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, page])

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
    { label: 'Fees', href: '/admin/fees', icon: '💳' },
    { label: 'Announcements', href: '/admin/announcements', icon: '📢' },
    { label: 'Messages', href: '/admin/messages', icon: '💬' },
    { label: 'Interaction Logs', href: '/admin/interaction-logs', icon: '🕵️' },
  ]

  const columns = [
    {
      key: 'teacher',
      label: 'Teacher',
      sortable: true,
      renderCell: (row: TeacherAbsentRow) => formatName(row),
    },
    {
      key: 'email',
      label: 'Email',
      renderCell: (row: TeacherAbsentRow) => row.teacher?.email || '-',
    },
    {
      key: 'startDate',
      label: 'Start Date',
      sortable: true,
      renderCell: (row: TeacherAbsentRow) => new Date(row.startDate).toLocaleDateString(),
    },
    {
      key: 'endDate',
      label: 'End Date',
      sortable: true,
      renderCell: (row: TeacherAbsentRow) => new Date(row.endDate).toLocaleDateString(),
    },
    {
      key: 'reason',
      label: 'Reason',
      renderCell: (row: TeacherAbsentRow) => row.reason || '-',
    },
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teachers Absent</h1>
          <p className="text-gray-600 mt-2">Teachers with approved off-days for the selected date.</p>
        </div>

        <Card title="Date Filter">
          <div className="max-w-xs">
            <Input
              label="Date"
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value)
                setPage(1)
              }}
            />
          </div>
        </Card>

        <Table
          title="Absent Teachers"
          columns={columns}
          data={pagedRows}
          loading={loading}
          totalCount={rows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          rowKey="id"
          emptyMessage="No teachers are absent on this date."
        />
      </div>
    </DashboardLayout>
  )
}
