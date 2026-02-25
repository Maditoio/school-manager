'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

interface Teacher {
  id: string
  firstName: string
  lastName: string
  email: string
  title?: string
  phone?: string
  createdAt: string
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
    if (session?.user?.role !== 'SCHOOL_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session) {
      fetchTeachers()
    }
  }, [session])

  const fetchTeachers = async () => {
    try {
      const res = await fetch('/api/users?role=TEACHER')
      if (res.ok) {
        const data = await res.json()
        setTeachers(Array.isArray(data.users) ? data.users : [])
      } else {
        setTeachers([])
      }
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

  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { label: 'Students', href: '/admin/students', icon: '👨‍🎓' },
    { label: 'Teachers', href: '/admin/teachers', icon: '👨‍🏫' },
    { label: 'Classes', href: '/admin/classes', icon: '🏫' },
    { label: 'Subjects', href: '/admin/subjects', icon: '📚' },
    { label: 'Attendance', href: '/admin/attendance', icon: '📅' },
    { label: 'Results', href: '/admin/results', icon: '📝' },
    { label: 'Announcements', href: '/admin/announcements', icon: '📢' },
    { label: 'Messages', href: '/admin/messages', icon: '💬' },
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Teachers Management</h1>
            <p className="text-gray-600 mt-2">Manage all teachers in your school</p>
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

        {loading ? (
          <div>Loading teachers...</div>
        ) : teachers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teachers.map((teacher) => (
              <Card key={teacher.id} className="p-6">
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {teacher.title ? `${teacher.title} ` : ''}{teacher.firstName} {teacher.lastName}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>📧 {teacher.email}</p>
                    {teacher.phone && <p>📱 {teacher.phone}</p>}
                    <p>📅 Joined: {new Date(teacher.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2 pt-3">
                    <Button variant="secondary" onClick={() => handleResetPassword(teacher)}>
                      Reset Password
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(teacher.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-gray-500">No teachers found. Click &quot;Add Teacher&quot; to create one.</p>
          </Card>
        )}

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
