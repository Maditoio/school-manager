'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { AlertTriangle, CircleCheck, Plus, Receipt, Users, Wallet } from 'lucide-react'

type FeePeriodType = 'MONTHLY' | 'SEMESTER' | 'YEARLY'
type FeeStatus = 'PAID' | 'PARTIAL' | 'NOT_PAID'

type Schedule = {
  id: string
  periodType: FeePeriodType
  year: number
  month: number | null
  semester: number | null
  amountDue: number
  label: string
}

type Summary = {
  studentsCount: number
  payingCount: number
  notPayingCount: number
  collectedAmount: number
  pendingAmount: number
}

type StudentStatus = {
  studentId: string
  studentName: string
  admissionNumber: string | null
  className: string
  amountDue: number
  totalPaid: number
  balance: number
  status: FeeStatus
  lastPaymentDate: string | null
}

type RecentPayment = {
  id: string
  paymentNumber: string
  amountPaid: number
  paymentDate: string
  studentName: string
  admissionNumber: string | null
  className: string
}

export default function AdminFeesPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState('')
  const [summary, setSummary] = useState<Summary>({
    studentsCount: 0,
    payingCount: 0,
    notPayingCount: 0,
    collectedAmount: 0,
    pendingAmount: 0,
  })
  const [studentStatuses, setStudentStatuses] = useState<StudentStatus[]>([])
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([])

  const [scheduleForm, setScheduleForm] = useState({
    periodType: 'MONTHLY' as FeePeriodType,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    semester: 1,
    amountDue: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    amountPaid: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  const [creatingSchedule, setCreatingSchedule] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [lastInvoiceId, setLastInvoiceId] = useState('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [tableSearchQuery, setTableSearchQuery] = useState('')
  const [tableClassFilter, setTableClassFilter] = useState('')
  const [paymentModalSearchQuery, setPaymentModalSearchQuery] = useState('')
  const [showPaymentStudentDropdown, setShowPaymentStudentDropdown] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }

    if (session?.user?.role !== 'SCHOOL_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  const selectedSchedule = useMemo(
    () => schedules.find((item) => item.id === selectedScheduleId) || null,
    [schedules, selectedScheduleId]
  )

  const filteredStudentStatuses = useMemo(() => {
    let filtered = studentStatuses

    if (tableSearchQuery.trim()) {
      const query = tableSearchQuery.toLowerCase()
      filtered = filtered.filter(
        (student) =>
          student.studentName.toLowerCase().includes(query) ||
          (student.admissionNumber && student.admissionNumber.toLowerCase().includes(query))
      )
    }

    if (tableClassFilter) {
      filtered = filtered.filter((student) => student.className === tableClassFilter)
    }

    return filtered
  }, [studentStatuses, tableSearchQuery, tableClassFilter])

  const filteredPaymentStudents = useMemo(() => {
    if (!paymentModalSearchQuery.trim()) return []
    const query = paymentModalSearchQuery.toLowerCase()
    return studentStatuses.filter(
      (student) =>
        student.studentName.toLowerCase().includes(query) ||
        (student.admissionNumber && student.admissionNumber.toLowerCase().includes(query))
    )
  }, [studentStatuses, paymentModalSearchQuery])

  const uniqueClasses = useMemo(
    () => Array.from(new Set(studentStatuses.map((s) => s.className))).sort(),
    [studentStatuses]
  )

  const fetchFeesData = useCallback(async (scheduleId?: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (scheduleId) {
        params.set('scheduleId', scheduleId)
      }

      const res = await fetch(`/api/fees${params.toString() ? `?${params.toString()}` : ''}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })

      const contentType = res.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')
      const data = isJson ? await res.json() : null

      if (!res.ok) {
        if (isJson) {
          throw new Error(data?.details || data?.error || 'Failed to fetch fees')
        }

        const text = await res.text()
        throw new Error(text || 'Invalid server response. Please refresh and login again.')
      }

      if (!data) {
        throw new Error('Invalid server response. Please refresh and login again.')
      }

      const schedulesData = Array.isArray(data.schedules) ? data.schedules : []

      setSchedules(schedulesData)
      setSummary(
        data.summary || {
          studentsCount: 0,
          payingCount: 0,
          notPayingCount: 0,
          collectedAmount: 0,
          pendingAmount: 0,
        }
      )
      setStudentStatuses(Array.isArray(data.studentStatuses) ? data.studentStatuses : [])
      setRecentPayments(Array.isArray(data.recentPayments) ? data.recentPayments : [])

      const selected = data.selectedSchedule?.id || schedulesData[0]?.id || ''
      setSelectedScheduleId(selected)

      if (!paymentForm.studentId && Array.isArray(data.studentStatuses) && data.studentStatuses.length > 0) {
        setPaymentForm((prev) => ({ ...prev, studentId: data.studentStatuses[0].studentId }))
      }
    } catch (error) {
      console.error('Failed to fetch fees data:', error)
      const message = error instanceof Error ? error.message : 'Failed to load fees data'
      showToast(message, 'error')
      setSchedules([])
      setSummary({ studentsCount: 0, payingCount: 0, notPayingCount: 0, collectedAmount: 0, pendingAmount: 0 })
      setStudentStatuses([])
      setRecentPayments([])
    } finally {
      setLoading(false)
    }
  }, [paymentForm.studentId, showToast])

  useEffect(() => {
    if (session?.user) {
      fetchFeesData()
    }
  }, [session?.user, fetchFeesData])

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault()

    const amountDue = Number(scheduleForm.amountDue)
    if (!amountDue || amountDue <= 0) {
      showToast('Enter a valid fee amount', 'warning')
      return
    }

    setCreatingSchedule(true)
    try {
      const payload: Record<string, unknown> = {
        action: 'createSchedule',
        periodType: scheduleForm.periodType,
        year: Number(scheduleForm.year),
        amountDue,
      }

      if (scheduleForm.periodType === 'MONTHLY') {
        payload.month = Number(scheduleForm.month)
      }

      if (scheduleForm.periodType === 'SEMESTER') {
        payload.semester = Number(scheduleForm.semester)
      }

      const res = await fetch('/api/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const responseContentType = res.headers.get('content-type') || ''
      const isJson = responseContentType.includes('application/json')
      const data = isJson ? await res.json() : null

      if (!res.ok) {
        const err = data
        const message =
          typeof err?.details === 'string'
            ? err.details
            :
          typeof err?.error === 'string'
            ? err.error
            : Array.isArray(err?.error)
              ? err.error.map((item: { message?: string }) => item?.message).filter(Boolean).join(', ')
              : !isJson
                ? 'Invalid server response while creating schedule'
                : 'Failed to create schedule'
        showToast(message, 'error')
        return
      }

      showToast('Fee schedule saved', 'success')
      setLastInvoiceId('')
      setShowScheduleModal(false)
      setScheduleForm({
        periodType: 'MONTHLY',
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        semester: 1,
        amountDue: '',
      })
      await fetchFeesData(data?.schedule?.id)
    } catch (error) {
      console.error('Failed to create schedule:', error)
      showToast('Failed to create schedule', 'error')
    } finally {
      setCreatingSchedule(false)
    }
  }

  const handleSelectStudent = (studentId: string) => {
    setPaymentForm((prev) => ({ ...prev, studentId }))
    setPaymentModalSearchQuery('')
    setShowPaymentStudentDropdown(false)
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedScheduleId) {
      showToast('Create or select a schedule first', 'warning')
      return
    }

    if (!paymentForm.studentId) {
      showToast('Select a student', 'warning')
      return
    }

    const amountPaid = Number(paymentForm.amountPaid)
    if (!amountPaid || amountPaid <= 0) {
      showToast('Enter a valid payment amount', 'warning')
      return
    }

    setRecordingPayment(true)
    try {
      const res = await fetch('/api/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recordPayment',
          scheduleId: selectedScheduleId,
          studentId: paymentForm.studentId,
          amountPaid,
          paymentDate: paymentForm.paymentDate,
          notes: paymentForm.notes,
        }),
      })

      const responseContentType = res.headers.get('content-type') || ''
      const isJson = responseContentType.includes('application/json')
      const data = isJson ? await res.json() : null

      if (!res.ok) {
        const err = data
        showToast(err?.details || err?.error || 'Failed to record payment', 'error')
        return
      }

      setLastInvoiceId(data?.payment?.id || '')
      setPaymentForm({ studentId: '', amountPaid: '', paymentDate: new Date().toISOString().slice(0, 10), notes: '' })
      setPaymentModalSearchQuery('')
      showToast('Payment recorded successfully', 'success')
      setShowPaymentModal(false)
      await fetchFeesData(selectedScheduleId)
    } catch (error) {
      console.error('Failed to record payment:', error)
      showToast('Failed to record payment', 'error')
    } finally {
      setRecordingPayment(false)
    }
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
  ]

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold ui-text-primary">Fees Management</h1>
            <p className="mt-1 ui-text-secondary">Track payments by month, semester, or year and generate invoices.</p>
          </div>
          <div className="flex gap-2">
            {lastInvoiceId && (
              <Link
                href={`/admin/fees/invoice/${lastInvoiceId}`}
                target="_blank"
                className="ui-button ui-button-primary inline-flex items-center gap-2"
              >
                <Receipt className="h-4 w-4" />
                Open Last Invoice
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="ui-button ui-button-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Fee Schedule
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="ui-button ui-button-secondary inline-flex items-center gap-2"
          >
            <Wallet className="h-4 w-4" />
            Record Payment
          </button>
        </div>

        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
            <Card title="Create Fee Schedule" className="w-full max-w-md">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="absolute right-4 top-4 ui-text-secondary hover:ui-text-primary"
              >
                ✕
              </button>
              <form onSubmit={handleCreateSchedule} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium ui-text-secondary">Period Type</label>
                    <select
                      value={scheduleForm.periodType}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          periodType: e.target.value as FeePeriodType,
                        }))
                      }
                      className="ui-select"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="SEMESTER">Semester</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium ui-text-secondary">Year</label>
                    <input
                      type="number"
                      value={scheduleForm.year}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, year: Number(e.target.value) }))}
                      className="ui-input"
                    />
                  </div>
                </div>

                {scheduleForm.periodType === 'MONTHLY' && (
                  <div>
                    <label className="mb-1 block text-sm font-medium ui-text-secondary">Month</label>
                    <select
                      value={scheduleForm.month}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, month: Number(e.target.value) }))}
                      className="ui-select"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <option key={month} value={month}>
                          {new Date(2026, month - 1, 1).toLocaleDateString('en-US', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {scheduleForm.periodType === 'SEMESTER' && (
                  <div>
                    <label className="mb-1 block text-sm font-medium ui-text-secondary">Semester</label>
                    <select
                      value={scheduleForm.semester}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, semester: Number(e.target.value) }))}
                      className="ui-select"
                    >
                      <option value={1}>Semester 1</option>
                      <option value={2}>Semester 2</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium ui-text-secondary">Fee Amount Per Student</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={scheduleForm.amountDue}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, amountDue: e.target.value }))}
                    placeholder="e.g. 250"
                    className="ui-input"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" isLoading={creatingSchedule} className="flex-1">
                    Save Schedule
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(false)}
                    className="flex-1 ui-button ui-button-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
            <Card title="Record Payment" className="w-full max-w-md">
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setPaymentModalSearchQuery('')
                  setShowPaymentStudentDropdown(false)
                }}
                className="absolute right-4 top-4 ui-text-secondary hover:ui-text-primary"
              >
                ✕
              </button>
              <form onSubmit={handleRecordPayment} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium ui-text-secondary">Active Schedule</label>
                  <select
                    value={selectedScheduleId}
                    onChange={(e) => {
                      const newId = e.target.value
                      setSelectedScheduleId(newId)
                      fetchFeesData(newId)
                    }}
                    className="ui-select"
                  >
                    <option value="">Select schedule</option>
                    {schedules.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.label} - {schedule.amountDue}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium ui-text-secondary">Student</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={paymentModalSearchQuery}
                      onChange={(e) => {
                        setPaymentModalSearchQuery(e.target.value)
                        setShowPaymentStudentDropdown(true)
                      }}
                      onFocus={() => setShowPaymentStudentDropdown(true)}
                      placeholder="Search by name or admission number..."
                      className="ui-input"
                    />
                    {paymentForm.studentId && (
                      <div
                        className="mt-1 rounded-[10px] border p-2 text-sm ui-text-primary"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}
                      >
                        {studentStatuses.find((s) => s.studentId === paymentForm.studentId)?.studentName}
                      </div>
                    )}
                    {showPaymentStudentDropdown && paymentModalSearchQuery.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-40 overflow-y-auto rounded-[10px] ui-popover">
                        {filteredPaymentStudents.length > 0 ? (
                          filteredPaymentStudents.map((student) => (
                            <button
                              key={student.studentId}
                              type="button"
                              onClick={() => handleSelectStudent(student.studentId)}
                              className="w-full px-3 py-2 text-left text-sm ui-hover-surface"
                            >
                              <div className="font-medium ui-text-primary">{student.studentName}</div>
                              <div className="text-xs ui-text-secondary">{student.className} • {student.admissionNumber || 'No admission'}</div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm ui-text-secondary">No students found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium ui-text-secondary">Amount Paid</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentForm.amountPaid}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, amountPaid: e.target.value }))}
                      className="ui-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium ui-text-secondary">Payment Date</label>
                    <input
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                      className="ui-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium ui-text-secondary">Notes (Optional)</label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="ui-textarea"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" isLoading={recordingPayment} className="flex-1" disabled={!selectedSchedule || loading}>
                    Record Payment
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentModal(false)
                      setPaymentModalSearchQuery('')
                      setShowPaymentStudentDropdown(false)
                    }}
                    className="flex-1 ui-button ui-button-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Card>
          </div>
        )}


        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Students" value={summary.studentsCount} icon={<Users className="h-4 w-4" />} />
          <StatCard title="Fully Paid" value={summary.payingCount} icon={<CircleCheck className="h-4 w-4" />} />
          <StatCard title="Not Fully Paid" value={summary.notPayingCount} icon={<AlertTriangle className="h-4 w-4" />} />
          <StatCard title="Collected" value={summary.collectedAmount.toFixed(2)} icon={<Wallet className="h-4 w-4" />} />
        </div>

        <Card title="Pending Collection">
          <div className="text-2xl font-semibold text-rose-500">{summary.pendingAmount.toFixed(2)}</div>
          <p className="mt-1 text-sm ui-text-secondary">Amount still to be collected for selected period.</p>
        </Card>

        <Card title="Payment Status by Student">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium ui-text-secondary">Search by Name or Admission #</label>
              <input
                type="text"
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                placeholder="e.g., John or ADM-2024-001..."
                className="ui-input"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium ui-text-secondary">Filter by Class</label>
              <input
                type="text"
                value={tableClassFilter}
                onChange={(e) => setTableClassFilter(e.target.value)}
                placeholder="Start typing class name..."
                list="class-suggestions"
                className="ui-input"
              />
              <datalist id="class-suggestions">
                {uniqueClasses.map((className) => (
                  <option key={className} value={className} />
                ))}
              </datalist>
            </div>
            {(tableSearchQuery || tableClassFilter) && (
              <button
                onClick={() => {
                  setTableSearchQuery('')
                  setTableClassFilter('')
                }}
                className="ui-button ui-button-secondary"
              >
                Clear
              </button>
            )}
          </div>
          <div className="text-xs ui-text-secondary mb-2">
            Showing {filteredStudentStatuses.length} of {studentStatuses.length} students
          </div>
          <div className="ui-table-wrap overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Due</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudentStatuses.map((student) => (
                  <tr key={student.studentId}>
                    <td>
                      {student.studentName}
                      <div className="text-xs ui-text-secondary">{student.admissionNumber || 'No admission number'}</div>
                    </td>
                    <td>{student.className}</td>
                    <td>{student.amountDue.toFixed(2)}</td>
                    <td>{student.totalPaid.toFixed(2)}</td>
                    <td>{student.balance.toFixed(2)}</td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          student.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-700'
                            : student.status === 'PARTIAL'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {student.status === 'NOT_PAID' ? 'NOT PAID' : student.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredStudentStatuses.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="text-center text-sm ui-text-secondary">
                      {tableSearchQuery || tableClassFilter ? 'No students match your filters.' : 'No students found for this schedule year.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Recent Payments">
          <div className="ui-table-wrap overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Payment #</th>
                  <th>Student</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.paymentNumber}</td>
                    <td>
                      {payment.studentName}
                      <div className="text-xs ui-text-secondary">{payment.className}</div>
                    </td>
                    <td>{payment.amountPaid.toFixed(2)}</td>
                    <td>
                      {new Date(payment.paymentDate).toLocaleDateString()}
                    </td>
                    <td>
                      <Link
                        href={`/admin/fees/invoice/${payment.id}`}
                        target="_blank"
                        className="ui-text-primary hover:underline"
                      >
                        View Invoice
                      </Link>
                    </td>
                  </tr>
                ))}
                {recentPayments.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center text-sm ui-text-secondary">
                      No payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
