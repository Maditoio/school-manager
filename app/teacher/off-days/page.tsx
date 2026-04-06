'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, TextArea } from '@/components/ui/Form'
import Table from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'

type OffDayRecord = {
  id: string
  startDate: string
  endDate: string
  reason: string | null
  createdAt: string
}

export default function TeacherOffDaysPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [records, setRecords] = useState<OffDayRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'TEACHER') {
      redirect('/login')
    }
  }, [session, status])

  const fetchOffDays = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/teacher-off-days', { cache: 'no-store' })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        showToast(error.error || 'Failed to fetch off-day bookings', 'error')
        setRecords([])
        return
      }

      const data = await res.json()
      setRecords(Array.isArray(data.offDays) ? data.offDays : [])
    } catch (error) {
      console.error('Failed to fetch off-days:', error)
      showToast('Failed to fetch off-day bookings', 'error')
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (session?.user?.role === 'TEACHER') {
      fetchOffDays()
    }
  }, [session, fetchOffDays])

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return records

    return records.filter((record) => {
      const reason = (record.reason || '').toLowerCase()
      const start = new Date(record.startDate).toLocaleDateString().toLowerCase()
      const end = new Date(record.endDate).toLocaleDateString().toLowerCase()
      return reason.includes(q) || start.includes(q) || end.includes(q)
    })
  }, [records, search])

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRecords.slice(start, start + pageSize)
  }, [filteredRecords, page])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!formData.startDate || !formData.endDate) {
      showToast('Start date and end date are required', 'warning')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/teacher-off-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(payload.error || 'Failed to submit off-day booking', 'error')
        return
      }

      showToast('Off-day booking submitted', 'success')
      setFormData({ startDate: '', endDate: '', reason: '' })
      await fetchOffDays()
      setPage(1)
    } catch (error) {
      console.error('Failed to submit off-day booking:', error)
      showToast('Failed to submit off-day booking', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/teacher-off-days/${id}`, { method: 'DELETE' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(payload.error || 'Failed to cancel booking', 'error')
        return
      }

      showToast('Off-day booking cancelled', 'success')
      await fetchOffDays()
    } catch (error) {
      console.error('Failed to cancel booking:', error)
      showToast('Failed to cancel booking', 'error')
    }
  }

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = TEACHER_NAV_ITEMS

  const columns = [
    {
      key: 'startDate',
      label: 'Start Date',
      sortable: true,
      renderCell: (row: OffDayRecord) => new Date(row.startDate).toLocaleDateString(),
    },
    {
      key: 'endDate',
      label: 'End Date',
      sortable: true,
      renderCell: (row: OffDayRecord) => new Date(row.endDate).toLocaleDateString(),
    },
    {
      key: 'reason',
      label: 'Reason',
      renderCell: (row: OffDayRecord) => row.reason || '-',
    },
    {
      key: 'createdAt',
      label: 'Submitted',
      sortable: true,
      renderCell: (row: OffDayRecord) => new Date(row.createdAt).toLocaleString(),
    },
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
          <h1 className="text-3xl font-bold text-gray-900">Book Off Day</h1>
          <p className="text-gray-600 mt-2">Select start and end date to mark your absence period.</p>
        </div>

        <Card title="New Off-Day Booking">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.startDate}
              onChange={(event) => setFormData((prev) => ({ ...prev, startDate: event.target.value }))}
            />
            <Input
              label="End Date"
              type="date"
              value={formData.endDate}
              onChange={(event) => setFormData((prev) => ({ ...prev, endDate: event.target.value }))}
            />
            <TextArea
              label="Reason (Optional)"
              value={formData.reason}
              onChange={(event) => setFormData((prev) => ({ ...prev, reason: event.target.value }))}
              rows={1}
            />
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" isLoading={submitting}>Submit Booking</Button>
            </div>
          </form>
        </Card>

        <Table
          title="My Off-Day Bookings"
          columns={columns}
          data={paginatedRecords}
          loading={loading}
          totalCount={filteredRecords.length}
          page={page}
          pageSize={pageSize}
          onSearch={setSearch}
          onPageChange={setPage}
          getRowActions={(row: OffDayRecord) => [
            {
              label: 'Cancel Booking',
              danger: true,
              onClick: () => handleDelete(row.id),
            },
          ]}
          rowKey="id"
          emptyMessage="No off-day bookings yet."
        />
      </div>
    </DashboardLayout>
  )
}
