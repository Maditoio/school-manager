'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

interface Teacher {
  id: string
  firstName: string
  lastName: string
  email: string
  title?: string
  phone?: string
  createdAt: string
  availability: 'Available' | 'Away'
}

export default function TeachersPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkUploadLoading, setBulkUploadLoading] = useState(false)
  const [bulkUploadErrors, setBulkUploadErrors] = useState<Array<{ row: number; error: string }>>([])
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Available' | 'Away'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN' && session?.user?.role !== 'DEPUTY_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session) {
      fetchTeachers()
    }
  }, [session])

  useEffect(() => {
    const close = () => { setOpenActionMenuId(null); setMenuPosition(null) }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [])

  const fetchTeachers = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [teachersResponse, offDaysResponse] = await Promise.all([
        fetch('/api/users?role=TEACHER'),
        fetch(`/api/teacher-off-days?activeOn=${encodeURIComponent(today)}`),
      ])

      if (!teachersResponse.ok) {
        setTeachers([])
        return
      }

      const teachersPayload = await teachersResponse.json()
      const users = Array.isArray(teachersPayload.users) ? teachersPayload.users : []

      const offDaySet = new Set<string>()
      if (offDaysResponse.ok) {
        const offDaysPayload = await offDaysResponse.json()
        const offDays = Array.isArray(offDaysPayload.offDays) ? offDaysPayload.offDays : []
        offDays.forEach((row: { teacherId?: string }) => {
          if (row.teacherId) offDaySet.add(row.teacherId)
        })
      }

      const rows: Teacher[] = users
        .map((teacher: Omit<Teacher, 'availability'>) => ({
          ...teacher,
          availability: offDaySet.has(teacher.id) ? 'Away' : 'Available',
        }))
        .sort((a: Teacher, b: Teacher) => {
          if (a.availability !== b.availability) {
            return a.availability === 'Away' ? -1 : 1
          }
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        })

      setTeachers(rows)
    } catch (error) {
      console.error('Failed to fetch teachers:', error)
      setTeachers([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, role: 'TEACHER' }),
      })

      if (res.ok) {
        await fetchTeachers()
        setShowModal(false)
        resetForm()
        showToast('Teacher created successfully!', 'success')
      } else {
        const error = await res.json()
        const apiError =
          Array.isArray(error.error) && error.error[0]?.message
            ? String(error.error[0].message)
            : typeof error.error === 'string'
              ? error.error
              : 'Failed to save teacher'
        showToast(apiError, 'error')
      }
    } catch (error) {
      console.error('Failed to save teacher:', error)
      showToast('Failed to save teacher', 'error')
    }
  }

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setBulkUploadLoading(true)
    setBulkUploadErrors([])

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('file', file)

      const res = await fetch('/api/teachers/bulk-upload', {
        method: 'POST',
        body: formDataToSend,
      })

      const data = await res.json()

      if (res.ok) {
        await fetchTeachers()
        setShowBulkModal(false)
        showToast(`Successfully created ${data.created} teacher(s)!`, 'success')
      } else {
        if (data.errors && data.errors.length > 0) {
          setBulkUploadErrors(data.errors)
          showToast(`Failed to create ${data.failed} row(s). See errors below.`, 'error')
        } else {
          showToast(data.error || 'Failed to upload teachers', 'error')
        }
      }
    } catch (error) {
      console.error('Failed to upload teachers:', error)
      showToast('Failed to upload teachers', 'error')
    } finally {
      setBulkUploadLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this teacher?')) return
    
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchTeachers()
        showToast('Teacher deleted successfully!', 'success')
      }
    } catch (error) {
      console.error('Failed to delete teacher:', error)
      showToast('Failed to delete teacher', 'error')
    }
  }

  const handleResetPassword = async (teacher: Teacher) => {
    const newPassword = prompt(`Enter a temporary password for ${teacher.firstName} ${teacher.lastName} (min 6 chars):`)
    if (!newPassword) return

    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }

    try {
      const res = await fetch(`/api/users/${teacher.id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to reset password', 'error')
        return
      }

      showToast('Password reset. Teacher must change it on first login.', 'success')
    } catch (error) {
      console.error('Failed to reset teacher password:', error)
      showToast('Failed to reset password', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
    })
  }

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/api/teachers/bulk-upload/template')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'teachers-bulk-upload-template.xlsx'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to download template:', error)
      showToast('Failed to download template', 'error')
    }
  }

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = ADMIN_NAV_ITEMS

  const statusFilteredTeachers =
    statusFilter === 'ALL'
      ? teachers
      : teachers.filter((teacher) => teacher.availability === statusFilter)

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredTeachers =
    normalizedSearch.length === 0
      ? statusFilteredTeachers
      : statusFilteredTeachers.filter((teacher) => {
          const fullName = `${teacher.title ? `${teacher.title} ` : ''}${teacher.firstName} ${teacher.lastName}`.toLowerCase()
          const email = teacher.email.toLowerCase()
          const phone = (teacher.phone || '').toLowerCase()
          return fullName.includes(normalizedSearch) || email.includes(normalizedSearch) || phone.includes(normalizedSearch)
        })

  const teacherTotals = {
    total: teachers.length,
    available: teachers.filter((teacher) => teacher.availability === 'Available').length,
    away: teachers.filter((teacher) => teacher.availability === 'Away').length,
  }

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session?.user?.role === 'DEPUTY_ADMIN' ? 'Deputy Admin' : 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900 p-5 shadow-lg shadow-black/20 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">School Pulse</p>
              <h1 className="text-3xl font-bold text-slate-100">Teachers Management</h1>
              <p className="mt-2 text-sm text-slate-400">Manage all teachers in your school</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowBulkModal(true)
                  setBulkUploadErrors([])
                }}
              >
                Bulk Upload
              </Button>
              <Button
                onClick={() => {
                  resetForm()
                  setShowModal(true)
                }}
              >
                Add Teacher
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
              Total: {teacherTotals.total}
            </span>
            <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              Available: {teacherTotals.available}
            </span>
            <span className="inline-flex items-center rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300">
              Away: {teacherTotals.away}
            </span>
          </div>
        </div>

        {!loading ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm ui-text-secondary">{filteredTeachers.length} teacher(s)</p>
            <div className="flex items-center gap-2">
              <label htmlFor="teachers-status-filter" className="text-sm ui-text-secondary">Filter</label>
              <select
                id="teachers-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'Available' | 'Away')}
                className="ui-select h-8 min-w-36"
              >
                <option value="ALL">All</option>
                <option value="Available">Available</option>
                <option value="Away">Away</option>
              </select>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teacher..."
                className="ui-input h-8 w-56"
              />
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="min-h-[52vh] flex items-center justify-center">
            <div className="w-full space-y-3">
              <div className="flex items-center justify-center gap-2">
                <div className="h-2 w-2 rounded-full bg-(--accent) animate-pulse" />
                <p className="text-sm ui-text-secondary">Loading teachers...</p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-(--border-subtle) bg-(--surface)">
                <table className="ui-table min-w-full">
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <tr key={`teacher-loading-${index}`}>
                        <td><div className="h-3.5 w-40 rounded bg-(--surface-soft) animate-pulse" /></td>
                        <td><div className="h-3.5 w-52 rounded bg-(--surface-soft) animate-pulse" /></td>
                        <td><div className="h-3.5 w-28 rounded bg-(--surface-soft) animate-pulse" /></td>
                        <td><div className="h-5 w-16 rounded-full bg-(--surface-soft) animate-pulse" /></td>
                        <td><div className="h-3.5 w-24 rounded bg-(--surface-soft) animate-pulse" /></td>
                        <td><div className="h-8 w-8 rounded-lg bg-(--surface-soft) animate-pulse" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : filteredTeachers.length > 0 ? (
          <div className="rounded-xl border border-(--border-subtle) bg-(--surface) teachers-no-hover" onClick={() => { setOpenActionMenuId(null); setMenuPosition(null) }}>
            <div className="overflow-x-auto">
            <table className="ui-table min-w-full">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>
                      <a href={`/admin/teachers/${teacher.id}`} className="font-medium ui-text-primary no-hover-link">
                        {teacher.title ? `${teacher.title} ` : ''}{teacher.firstName} {teacher.lastName}
                      </a>
                    </td>
                    <td>{teacher.email}</td>
                    <td>{teacher.phone || 'N/A'}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                          teacher.availability === 'Away'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {teacher.availability}
                      </span>
                    </td>
                    <td>{new Date(teacher.createdAt).toLocaleDateString()}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label="Teacher actions"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--border-subtle) bg-(--surface-soft) text-base leading-none ui-text-secondary hover:ui-text-primary"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (openActionMenuId === teacher.id) {
                            setOpenActionMenuId(null)
                            setMenuPosition(null)
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                            setOpenActionMenuId(teacher.id)
                          }
                        }}
                      >
                        ⋯
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-gray-500">No teachers match this filter.</p>
          </Card>
        )}

        <style jsx global>{`
          .teachers-no-hover .ui-table tbody tr:hover {
            background: inherit !important;
          }

          .teachers-no-hover .ui-table tbody tr:hover td {
            color: inherit !important;
          }

          .teachers-no-hover .no-hover-link:hover {
            text-decoration: none !important;
            color: inherit !important;
          }
        `}</style>

        {openActionMenuId && menuPosition ? (() => {
          const activeTeacher = teachers.find((t) => t.id === openActionMenuId)
          if (!activeTeacher) return null
          return (
            <div
              className="fixed z-200 min-w-44 rounded-[10px] border border-(--border-subtle) bg-(--surface) p-1.5 shadow-(--shadow-soft)"
              style={{ top: menuPosition.top, right: menuPosition.right }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm ui-text-secondary hover:bg-(--surface-soft) hover:ui-text-primary"
                onClick={() => {
                  setOpenActionMenuId(null)
                  setMenuPosition(null)
                  handleResetPassword(activeTeacher)
                }}
              >
                Reset Password
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  setOpenActionMenuId(null)
                  setMenuPosition(null)
                  handleDelete(activeTeacher.id)
                }}
              >
                Delete
              </button>
            </div>
          )
        })() : null}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md p-6">
              <h2 className="text-2xl font-bold mb-4">Add Teacher</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Mr., Mrs., Dr."
                  required
                />
                <Input
                  label="First Name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
                <Input
                  label="Last Name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1234567890"
                />
                <Input
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Leave blank to use default: default12345"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowModal(false)
                      resetForm()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Create</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {showBulkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">Bulk Upload Teachers</h2>
              
              <div className="space-y-4">
                <div>
                  <Button 
                    variant="secondary" 
                    onClick={downloadTemplate}
                    className="mb-4"
                  >
                    Download Template
                  </Button>
                  <p className="text-sm text-gray-600 mb-4">
                    Download the Excel template, fill it with teacher details, then upload it here.
                  </p>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleBulkUpload}
                    disabled={bulkUploadLoading}
                    className="hidden"
                    id="bulk-file-input"
                  />
                  <label htmlFor="bulk-file-input" className="cursor-pointer">
                    <div className="text-4xl mb-2">📁</div>
                    <p className="text-gray-700 font-medium">
                      {bulkUploadLoading ? 'Uploading...' : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-sm text-gray-500">Excel files (.xlsx, .xls) - Max 5MB</p>
                  </label>
                </div>

                {bulkUploadErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-900 mb-2">Upload Errors</h3>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {bulkUploadErrors.map((err, idx) => (
                        <p key={idx} className="text-sm text-red-700">
                          <strong>Row {err.row}:</strong> {err.error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowBulkModal(false)
                      setBulkUploadErrors([])
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
