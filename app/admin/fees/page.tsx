'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { AlertTriangle, CircleCheck, Plus, Receipt, Users, Wallet } from 'lucide-react'
import { ADMIN_NAV_ITEMS, FINANCE_NAV_ITEMS } from '@/lib/admin-nav'
import { useCurrency } from '@/lib/currency-context'

type FeePeriodType = 'MONTHLY' | 'SEMESTER' | 'YEARLY'
type FeeStatus = 'PAID' | 'PARTIAL' | 'NOT_PAID' | 'NO_SCHEDULE'
type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'M_PESA' | 'ORANGE_MONEY' | 'OTHER'

type FeesPageProps = {
  routePrefix?: '/admin' | '/finance'
  allowedRoles?: Array<'SCHOOL_ADMIN' | 'FINANCE' | 'FINANCE_MANAGER'>
  navMode?: 'admin' | 'finance'
}

function formatPaymentMethod(method: PaymentMethod) {
  if (method === 'CASH') return 'Cash'
  if (method === 'BANK_TRANSFER') return 'Bank Transfer'
  if (method === 'M_PESA') return 'M-Pesa'
  if (method === 'ORANGE_MONEY') return 'Orange Money'
  return 'Other'
}

type Period = {
  key: string
  periodType: FeePeriodType
  year: number
  month: number | null
  semester: number | null
  label: string
  hasClassSpecific: boolean
}

type PendingSchedule = {
  id: string
  periodType: FeePeriodType
  year: number
  month: number | null
  semester: number | null
  classId: string | null
  className: string | null
  amountDue: number
  createdAt: string
  periodLabel: string
  label: string
}

type AvailableClass = {
  id: string
  name: string
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
  classId: string | null
  scheduleId: string | null
  amountDue: number
  totalPaid: number
  balance: number
  status: FeeStatus
  lastPaymentDate: string | null
}

type RecentPayment = {
  id: string
  paymentMethod: PaymentMethod
  paymentNumber: string
  amountPaid: number
  paymentDate: string
  studentName: string
  admissionNumber: string | null
  className: string
}

export default function AdminFeesPage({
  routePrefix = '/admin',
  allowedRoles = ['SCHOOL_ADMIN'],
  navMode = 'admin',
}: FeesPageProps = {}) {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { formatCurrency } = useCurrency()
  const [loading, setLoading] = useState(true)
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriodKey, setSelectedPeriodKey] = useState('')
  const [pendingSchedules, setPendingSchedules] = useState<PendingSchedule[]>([])
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>([])
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
    classId: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    amountPaid: '',
    paymentMethod: 'CASH' as PaymentMethod,
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  const [creatingSchedule, setCreatingSchedule] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [approvingId, setApprovingId] = useState('')
  const [rejectingId, setRejectingId] = useState('')
  const [lastInvoiceId, setLastInvoiceId] = useState('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [tableSearchQuery, setTableSearchQuery] = useState('')
  const [tableClassFilter, setTableClassFilter] = useState('')
  const [statusTablePage, setStatusTablePage] = useState(1)
  const [recentSearchQuery, setRecentSearchQuery] = useState('')
  const [recentPaymentsPage, setRecentPaymentsPage] = useState(1)
  const [paymentModalSearchQuery, setPaymentModalSearchQuery] = useState('')
  const [showPaymentStudentDropdown, setShowPaymentStudentDropdown] = useState(false)
  const pageSize = 10

  const isAdmin = session?.user?.role === 'SCHOOL_ADMIN'

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }

    if (session?.user?.role && !allowedRoles.includes(session.user.role as 'SCHOOL_ADMIN' | 'FINANCE' | 'FINANCE_MANAGER')) {
      redirect('/login')
    }
  }, [allowedRoles, session, status])

  const selectedPeriod = useMemo(
    () => periods.find((p) => p.key === selectedPeriodKey) ?? null,
    [periods, selectedPeriodKey]
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

  const filteredRecentPayments = useMemo(() => {
    const query = recentSearchQuery.trim().toLowerCase()
    if (!query) return recentPayments

    return recentPayments.filter(
      (payment) =>
        payment.paymentNumber.toLowerCase().includes(query) ||
        formatPaymentMethod(payment.paymentMethod).toLowerCase().includes(query) ||
        payment.studentName.toLowerCase().includes(query) ||
        payment.className.toLowerCase().includes(query) ||
        String(payment.admissionNumber || '').toLowerCase().includes(query)
    )
  }, [recentPayments, recentSearchQuery])

  const statusPageRows = useMemo(() => {
    const start = (statusTablePage - 1) * pageSize
    return filteredStudentStatuses.slice(start, start + pageSize)
  }, [filteredStudentStatuses, statusTablePage])

  const recentPageRows = useMemo(() => {
    const start = (recentPaymentsPage - 1) * pageSize
    return filteredRecentPayments.slice(start, start + pageSize)
  }, [filteredRecentPayments, recentPaymentsPage])

  const statusColumns = useMemo(
    () => [
      {
        key: 'studentName',
        label: 'Student',
        sortable: true,
        renderCell: (student: StudentStatus) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-100">{student.studentName}</span>
            <span className="text-xs text-slate-400">{student.admissionNumber || 'No admission number'}</span>
          </div>
        ),
      },
      { key: 'className', label: 'Class', sortable: true },
      {
        key: 'amountDue',
        label: 'Due',
        sortable: true,
        renderCell: (student: StudentStatus) =>
          student.status === 'NO_SCHEDULE' ? (
            <span className="text-xs text-amber-400">No schedule</span>
          ) : (
            formatCurrency(student.amountDue)
          ),
      },
      {
        key: 'totalPaid',
        label: 'Paid',
        sortable: true,
        renderCell: (student: StudentStatus) => {
          const overpaidAmount = Math.max(student.totalPaid - student.amountDue, 0)
          return (
            <div className="flex items-center gap-1.5">
              <span>{formatCurrency(student.totalPaid)}</span>
              {overpaidAmount > 0 ? (
                <span
                  className="text-xs font-semibold text-emerald-500"
                  title={`Overpaid by ${formatCurrency(overpaidAmount)}`}
                >
                  +{formatCurrency(overpaidAmount)}
                </span>
              ) : null}
            </div>
          )
        },
      },
      {
        key: 'balance',
        label: 'Balance',
        sortable: true,
        renderCell: (student: StudentStatus) => {
          if (student.status === 'NO_SCHEDULE') return '-'
          if (student.balance < 0) {
            return (
              <span className="font-semibold text-emerald-500" title="Credit remaining">
                +{formatCurrency(Math.abs(student.balance))}
              </span>
            )
          }
          return formatCurrency(student.balance)
        },
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        renderCell: (student: StudentStatus) => {
          if (student.status === 'NO_SCHEDULE') return <span className="text-xs text-amber-400">—</span>
          return student.status === 'NOT_PAID' ? 'NOT PAID' : student.status
        },
      },
    ],
    []
  )

  const recentColumns = useMemo(
    () => [
      { key: 'paymentNumber', label: 'Payment #', sortable: true },
      {
        key: 'studentName',
        label: 'Student',
        sortable: true,
        renderCell: (payment: RecentPayment) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-100">{payment.studentName}</span>
            <span className="text-xs text-slate-400">{payment.className}</span>
          </div>
        ),
      },
      {
        key: 'paymentMethod',
        label: 'Method',
        sortable: true,
        renderCell: (payment: RecentPayment) => formatPaymentMethod(payment.paymentMethod),
      },
      {
        key: 'amountPaid',
        label: 'Amount',
        sortable: true,
        renderCell: (payment: RecentPayment) => formatCurrency(payment.amountPaid),
      },
      {
        key: 'paymentDate',
        label: 'Date',
        sortable: true,
        renderCell: (payment: RecentPayment) => new Date(payment.paymentDate).toLocaleDateString(),
      },
      {
        key: 'invoice',
        label: 'Invoice',
        renderCell: (payment: RecentPayment) => (
          <Link
            href={`${routePrefix}/fees/invoice/${payment.id}`}
            target="_blank"
            className="text-indigo-300 hover:underline"
          >
            View Invoice
          </Link>
        ),
      },
    ],
    [routePrefix]
  )

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/classes', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const classes: AvailableClass[] = (data.classes || []).map(
          (c: { id: string; name: string }) => ({ id: c.id, name: c.name })
        )
        setAvailableClasses(classes.sort((a, b) => a.name.localeCompare(b.name)))
      }
    } catch {
      // non-critical
    }
  }, [])

  const fetchFeesData = useCallback(
    async (periodKey?: string) => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (periodKey) {
          params.set('periodKey', periodKey)
        }

        const res = await fetch(`/api/fees${params.toString() ? `?${params.toString()}` : ''}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          headers: { Accept: 'application/json' },
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

        const periodsData: Period[] = Array.isArray(data.periods) ? data.periods : []

        setPeriods(periodsData)
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
        setPendingSchedules(Array.isArray(data.pendingSchedules) ? data.pendingSchedules : [])

        const selected = data.selectedPeriod?.key || periodsData[0]?.key || ''
        setSelectedPeriodKey(selected)
      } catch (error) {
        console.error('Failed to fetch fees data:', error)
        const message = error instanceof Error ? error.message : 'Failed to load fees data'
        showToast(message, 'error')
        setPeriods([])
        setSummary({ studentsCount: 0, payingCount: 0, notPayingCount: 0, collectedAmount: 0, pendingAmount: 0 })
        setStudentStatuses([])
        setRecentPayments([])
        setPendingSchedules([])
      } finally {
        setLoading(false)
      }
    },
    [showToast]
  )

  useEffect(() => {
    if (session?.user) {
      fetchFeesData()
      fetchClasses()
    }
  }, [session?.user, fetchFeesData, fetchClasses])

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

      if (scheduleForm.classId) {
        payload.classId = scheduleForm.classId
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
            : typeof err?.error === 'string'
            ? err.error
            : Array.isArray(err?.error)
            ? err.error.map((item: { message?: string }) => item?.message).filter(Boolean).join(', ')
            : !isJson
            ? 'Invalid server response while creating schedule'
            : 'Failed to create schedule'
        showToast(message, 'error')
        return
      }

      const successMsg =
        session?.user?.role === 'FINANCE'
          ? 'Fee schedule submitted for approval'
          : 'Fee schedule created successfully'
      showToast(successMsg, 'success')
      setLastInvoiceId('')
      setShowScheduleModal(false)
      setScheduleForm({
        periodType: 'MONTHLY',
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        semester: 1,
        amountDue: '',
        classId: '',
      })
      await fetchFeesData()
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

    if (!selectedPeriodKey) {
      showToast('Select a payment period first', 'warning')
      return
    }

    if (!paymentForm.studentId) {
      showToast('Select a student', 'warning')
      return
    }

    // Resolve the applicable scheduleId for the selected student
    const selectedStudentStatus = studentStatuses.find(
      (s) => s.studentId === paymentForm.studentId
    )

    if (!selectedStudentStatus?.scheduleId) {
      showToast('No approved fee schedule found for this student\'s class in the selected period', 'warning')
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
          scheduleId: selectedStudentStatus.scheduleId,
          studentId: paymentForm.studentId,
          amountPaid,
          paymentMethod: paymentForm.paymentMethod,
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
      setPaymentForm({
        studentId: '',
        amountPaid: '',
        paymentMethod: 'CASH',
        paymentDate: new Date().toISOString().slice(0, 10),
        notes: '',
      })
      setPaymentModalSearchQuery('')
      showToast('Payment recorded successfully', 'success')
      setShowPaymentModal(false)
      await fetchFeesData(selectedPeriodKey)
    } catch (error) {
      console.error('Failed to record payment:', error)
      showToast('Failed to record payment', 'error')
    } finally {
      setRecordingPayment(false)
    }
  }

  const handleApproveSchedule = async (id: string) => {
    setApprovingId(id)
    try {
      const res = await fetch(`/api/fees/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data?.error || 'Failed to approve schedule', 'error')
        return
      }

      showToast('Fee schedule approved', 'success')
      await fetchFeesData(selectedPeriodKey)
    } catch {
      showToast('Failed to approve schedule', 'error')
    } finally {
      setApprovingId('')
    }
  }

  const handleRejectSchedule = async (id: string) => {
    setRejectingId(id)
    try {
      const res = await fetch(`/api/fees/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data?.error || 'Failed to reject schedule', 'error')
        return
      }

      showToast('Schedule rejected and removed', 'success')
      await fetchFeesData(selectedPeriodKey)
    } catch {
      showToast('Failed to reject schedule', 'error')
    } finally {
      setRejectingId('')
    }
  }

  const navItems = navMode === 'finance' ? FINANCE_NAV_ITEMS : ADMIN_NAV_ITEMS

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const sessionRole = `${session.user.role}`

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: sessionRole === 'FINANCE' ? 'Finance' : 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold ui-text-primary">Fees Management</h1>
            <p className="mt-1 ui-text-secondary">
              Track payments by period. Each class can have its own fee rate or share one flat rate.
            </p>
          </div>
          <div className="flex gap-2">
            {lastInvoiceId && (
              <Link
                href={`${routePrefix}/fees/invoice/${lastInvoiceId}`}
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
          {(isAdmin || session?.user?.role === 'FINANCE_MANAGER') && (
          <button
            onClick={() => setShowScheduleModal(true)}
            className="ui-button ui-button-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Fee Schedule
          </button>
          )}
          {(isAdmin || session?.user?.role === 'FINANCE') && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="ui-button ui-button-secondary inline-flex items-center gap-2"
          >
            <Wallet className="h-4 w-4" />
            Record Payment
          </button>
          )}
        </div>

        {/* Pending approval panel (visible to both admin and finance) */}
        {pendingSchedules.length > 0 && (
          <Card
            title={`⏳ Fee Schedules Pending Approval (${pendingSchedules.length})`}
          >
            <div className="space-y-2">
              {pendingSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between gap-4 rounded-[10px] border px-4 py-3"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium ui-text-primary">{schedule.label}</span>
                    <span className="text-xs ui-text-secondary">
                      Amount: {formatCurrency(schedule.amountDue)} · Submitted{' '}
                      {new Date(schedule.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleApproveSchedule(schedule.id)}
                        disabled={approvingId === schedule.id || !!rejectingId}
                        className="ui-button ui-button-primary text-sm py-1 px-3"
                      >
                        {approvingId === schedule.id ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleRejectSchedule(schedule.id)}
                        disabled={rejectingId === schedule.id || !!approvingId}
                        className="ui-button ui-button-danger text-sm py-1 px-3"
                      >
                        {rejectingId === schedule.id ? 'Rejecting…' : 'Reject'}
                      </button>
                    </div>
                  )}
                  {!isAdmin && (
                    <span className="text-xs text-amber-400 font-medium shrink-0">Awaiting admin approval</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Create schedule modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
            <Card title="Create Fee Schedule" className="w-full max-w-md">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="absolute right-4 top-4 ui-text-secondary hover:ui-text-primary"
              >
                ✕
              </button>
              {sessionRole === 'FINANCE' && (
                <p className="mb-3 text-sm rounded-[8px] p-2 text-amber-400 bg-amber-400/10">
                  Schedules you create will be submitted to the admin for approval before taking effect.
                </p>
              )}
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
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, year: Number(e.target.value) }))
                      }
                      className="ui-input"
                    />
                  </div>
                </div>

                {scheduleForm.periodType === 'MONTHLY' && (
                  <div>
                    <label className="mb-1 block text-sm font-medium ui-text-secondary">Month</label>
                    <select
                      value={scheduleForm.month}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, month: Number(e.target.value) }))
                      }
                      className="ui-select"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          {new Date(2026, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })}
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
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, semester: Number(e.target.value) }))
                      }
                      className="ui-select"
                    >
                      <option value={1}>Semester 1</option>
                      <option value={2}>Semester 2</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium ui-text-secondary">
                    Applies To
                  </label>
                  <select
                    value={scheduleForm.classId}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, classId: e.target.value }))
                    }
                    className="ui-select"
                  >
                    <option value="">All classes (flat rate)</option>
                    {availableClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs ui-text-secondary">
                    Class-specific rates override the flat rate for students in that class.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium ui-text-secondary">
                    Fee Amount Per Student
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={scheduleForm.amountDue}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, amountDue: e.target.value }))
                    }
                    placeholder="e.g. 250"
                    className="ui-input"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" isLoading={creatingSchedule} className="flex-1">
                    {sessionRole === 'FINANCE' ? 'Submit for Approval' : 'Create Schedule'}
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

        {/* Record payment modal */}
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
                  <label className="mb-1 block text-sm font-medium ui-text-secondary">
                    Payment Period
                  </label>
                  <select
                    value={selectedPeriodKey}
                    onChange={(e) => {
                      const newKey = e.target.value
                      setSelectedPeriodKey(newKey)
                      setPaymentForm((prev) => ({ ...prev, studentId: '' }))
                      fetchFeesData(newKey)
                    }}
                    className="ui-select"
                  >
                    <option value="">Select period</option>
                    {periods.map((period) => (
                      <option key={period.key} value={period.key}>
                        {period.label}
                        {period.hasClassSpecific ? ' (class-specific rates)' : ''}
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
                      placeholder="Search by name or admission number…"
                      className="ui-input"
                    />
                    {paymentForm.studentId && (
                      <div
                        className="mt-1 rounded-[10px] border p-2 text-sm ui-text-primary"
                        style={{
                          borderColor: 'var(--border-subtle)',
                          background: 'var(--surface-soft)',
                        }}
                      >
                        {studentStatuses.find((s) => s.studentId === paymentForm.studentId)?.studentName}
                        {(() => {
                          const sel = studentStatuses.find(
                            (s) => s.studentId === paymentForm.studentId
                          )
                          if (!sel?.scheduleId)
                            return (
                              <span className="ml-2 text-xs text-amber-400">No fee schedule</span>
                            )
                          return (
                            <span className="ml-2 text-xs ui-text-secondary">
                              Due: {formatCurrency(sel.amountDue)}
                            </span>
                          )
                        })()}
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
                              <div className="text-xs ui-text-secondary">
                                {student.className} · {student.admissionNumber || 'No admission'}
                                {student.scheduleId ? ` · Due: ${formatCurrency(student.amountDue)}` : ' · No schedule'}
                              </div>
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
                    <label className="mb-1 block text-sm font-medium ui-text-secondary">
                      Amount Paid
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentForm.amountPaid}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({ ...prev, amountPaid: e.target.value }))
                      }
                      className="ui-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium ui-text-secondary">
                      Payment Method
                    </label>
                    <select
                      value={paymentForm.paymentMethod}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          paymentMethod: e.target.value as PaymentMethod,
                        }))
                      }
                      className="ui-select"
                    >
                      <option value="CASH">Cash</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="M_PESA">M-Pesa</option>
                      <option value="ORANGE_MONEY">Orange Money</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium ui-text-secondary">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))
                      }
                      className="ui-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium ui-text-secondary">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="ui-textarea"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    isLoading={recordingPayment}
                    className="flex-1"
                    disabled={!selectedPeriodKey || loading}
                  >
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

        {/* Period selector */}
        {periods.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium ui-text-secondary whitespace-nowrap">
              View Period:
            </label>
            <select
              value={selectedPeriodKey}
              onChange={(e) => {
                const newKey = e.target.value
                setSelectedPeriodKey(newKey)
                fetchFeesData(newKey)
              }}
              className="ui-select max-w-xs"
            >
              {periods.map((period) => (
                <option key={period.key} value={period.key}>
                  {period.label}
                  {period.hasClassSpecific ? ' ★' : ''}
                </option>
              ))}
            </select>
            {selectedPeriod?.hasClassSpecific && (
              <span className="text-xs ui-text-secondary">★ has class-specific rates</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Students"
            value={summary.studentsCount}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            title="Fully Paid"
            value={summary.payingCount}
            icon={<CircleCheck className="h-4 w-4" />}
          />
          <StatCard
            title="Not Fully Paid"
            value={summary.notPayingCount}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
          <StatCard
            title="Collected"
            value={formatCurrency(summary.collectedAmount)}
            icon={<Wallet className="h-4 w-4" />}
          />
        </div>

        <Card title="Pending Collection">
          <div className="text-2xl font-semibold text-rose-500">
            {formatCurrency(summary.pendingAmount)}
          </div>
          <p className="mt-1 text-sm ui-text-secondary">
            Amount still to be collected for selected period.
          </p>
        </Card>

        <Table
          title="Payment Status by Student"
          columns={statusColumns}
          data={statusPageRows}
          loading={loading}
          totalCount={filteredStudentStatuses.length}
          page={statusTablePage}
          pageSize={pageSize}
          onSearch={(value: string) => {
            setTableSearchQuery(value)
            setStatusTablePage(1)
          }}
          onPageChange={setStatusTablePage}
          filterOptions={[
            { value: '', label: 'All classes' },
            ...uniqueClasses.map((className) => ({ value: className, label: className })),
          ]}
          activeFilter={tableClassFilter}
          onFilterChange={(value: string) => {
            setTableClassFilter(value)
            setStatusTablePage(1)
          }}
          emptyMessage={
            tableSearchQuery || tableClassFilter
              ? 'No students match your filters.'
              : 'No students found for this schedule year.'
          }
          rowKey="studentId"
        />

        <Table
          title="Recent Payments"
          columns={recentColumns}
          data={recentPageRows}
          loading={loading}
          totalCount={filteredRecentPayments.length}
          page={recentPaymentsPage}
          pageSize={pageSize}
          onSearch={(value: string) => {
            setRecentSearchQuery(value)
            setRecentPaymentsPage(1)
          }}
          onPageChange={setRecentPaymentsPage}
          onFilterClick={() => {
            setRecentSearchQuery('')
            setRecentPaymentsPage(1)
          }}
          emptyMessage="No payments recorded yet."
          rowKey="id"
        />
      </div>
    </DashboardLayout>
  )
}
