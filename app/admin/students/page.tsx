'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

interface Student {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  admissionNumber: string | null
  classId: string
  class?: { id: string; name: string }
  parentId: string | null
  parentName?: string | null
  parentEmail?: string | null
  parentPhone?: string | null
  parent?: { firstName: string; lastName: string } | null
}

interface Class {
  id: string
  name: string
}

export default function StudentsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadSummary, setUploadSummary] = useState<{ created: number; failed: number } | null>(null)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    admissionNumber: '',
    classId: '',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
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
      fetchClasses()
    }
  }, [session])

  const fetchStudents = useCallback(async (
    page = currentPage,
    size = pageSize,
    query = searchTerm,
    classFilter = selectedClassId
  ) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(size),
      })

      const trimmedQuery = query.trim()
      if (trimmedQuery) {
        params.set('q', trimmedQuery)
      }

      if (classFilter) {
        params.set('classId', classFilter)
      }

      const res = await fetch(`/api/students?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setStudents(Array.isArray(data.students) ? data.students : [])

        const pagination = data.pagination
        if (pagination) {
          setTotalCount(Number(pagination.totalCount) || 0)
          setTotalPages(Math.max(1, Number(pagination.totalPages) || 1))

          const serverPage = Number(pagination.page) || 1
          if (serverPage !== page) {
            setCurrentPage(serverPage)
          }
        } else {
          const count = Array.isArray(data.students) ? data.students.length : 0
          setTotalCount(count)
          setTotalPages(1)
        }
      } else {
        setStudents([])
        setTotalCount(0)
        setTotalPages(1)
      }
    } catch (error) {
      console.error('Failed to fetch students:', error)
      setStudents([])
      setTotalCount(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, searchTerm, selectedClassId])

  useEffect(() => {
    if (session) {
      fetchStudents(currentPage, pageSize, searchTerm, selectedClassId)
    }
  }, [session, currentPage, pageSize, searchTerm, selectedClassId, fetchStudents])

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes')
      if (res.ok) {
        const data = await res.json()
        setClasses(Array.isArray(data.classes) ? data.classes : [])
      } else {
        setClasses([])
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error)
      setClasses([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingStudent ? `/api/students/${editingStudent.id}` : '/api/students'
      const method = editingStudent ? 'PUT' : 'POST'

      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth || undefined,
        admissionNumber: formData.admissionNumber || undefined,
        classId: formData.classId,
        parentName: formData.parentName || undefined,
        parentEmail: formData.parentEmail || undefined,
        parentPhone: formData.parentPhone || undefined,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        await fetchStudents(currentPage, pageSize, searchTerm, selectedClassId)
        setShowModal(false)
        resetForm()
        showToast(`Student ${editingStudent ? 'updated' : 'created'} successfully`, 'success')
      } else {
        const error = await res.json()
        showToast(error.error || 'Failed to save student', 'error')
      }
    } catch (error) {
      console.error('Failed to save student:', error)
      showToast('Failed to save student', 'error')
    }
  }

  const handleExcelUpload = async () => {
    if (!uploadFile) {
      showToast('Please choose an Excel file', 'warning')
      return
    }

    if (uploadFile.size > 5 * 1024 * 1024) {
      showToast('File is too large. Maximum supported size is 5MB.', 'error')
      return
    }

    setUploadSummary(null)
    setUploadErrors([])

    try {
      setUploading(true)
      const body = new FormData()
      body.append('file', uploadFile)

      const res = await fetch('/api/students/bulk-upload', {
        method: 'POST',
        body,
        credentials: 'same-origin',
      })

      const responseText = await res.text()
      let result: { error?: string; message?: string; created?: number; failed?: number; errors?: Array<{ row: number; error: string }> } = {}

      try {
        result = responseText ? JSON.parse(responseText) : {}
      } catch {
        result = {}
      }

      if (!res.ok) {
        const detailedErrors = Array.isArray(result.errors)
          ? result.errors.slice(0, 10).map((item) => `Row ${item.row}: ${item.error}`)
          : []

        setUploadSummary({ created: result.created || 0, failed: result.failed || 0 })
        setUploadErrors(detailedErrors)
        showToast(result.error || result.message || 'Bulk upload failed', 'error')
        return
      }

      await fetchStudents(currentPage, pageSize, searchTerm, selectedClassId)
      setUploadFile(null)
      const created = result.created || 0
      const failed = result.failed || 0
      const detailedErrors = Array.isArray(result.errors)
        ? result.errors.slice(0, 10).map((item) => `Row ${item.row}: ${item.error}`)
        : []

      setUploadSummary({ created, failed })
      setUploadErrors(detailedErrors)

      if (failed > 0) {
        showToast(`Upload processed: ${created} created, ${failed} failed`, created > 0 ? 'warning' : 'error')
      } else {
        showToast(`Upload complete: ${created} created`, 'success')
      }
    } catch (error) {
      console.error('Failed to upload students:', error)
      showToast('Network error during upload. Please refresh and try again.', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = (student: Student) => {
    setEditingStudent(student)

    setFormData({
      firstName: student.firstName,
      lastName: student.lastName,
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '',
      admissionNumber: student.admissionNumber || '',
      classId: student.classId,
      parentName: student.parentName || '',
      parentEmail: student.parentEmail || '',
      parentPhone: student.parentPhone || '',
    })

    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return

    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchStudents(currentPage, pageSize, searchTerm, selectedClassId)
        showToast('Student deleted successfully', 'success')
      } else {
        const error = await res.json()
        showToast(error.error || 'Failed to delete student', 'error')
      }
    } catch (error) {
      console.error('Failed to delete student:', error)
      showToast('Failed to delete student', 'error')
    }
  }

  const handleResetParentPassword = async (student: Student) => {
    if (!student.parentId) {
      showToast('No linked parent account for this student', 'warning')
      return
    }

    const newPassword = prompt(`Enter a temporary password for parent of ${student.firstName} ${student.lastName} (min 6 chars):`)
    if (!newPassword) return

    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }

    try {
      const res = await fetch(`/api/users/${student.parentId}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to reset parent password', 'error')
        return
      }

      showToast('Parent password reset. Parent must change it on first login.', 'success')
    } catch (error) {
      console.error('Failed to reset parent password:', error)
      showToast('Failed to reset parent password', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      admissionNumber: '',
      classId: '',
      parentName: '',
      parentEmail: '',
      parentPhone: '',
    })
    setEditingStudent(null)
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedClassId, pageSize])

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
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Students Management</h1>
            <p className="text-gray-600 mt-2">Manage students, classes, and parent contacts</p>
          </div>
          <Button
            onClick={() => {
              resetForm()
              setShowModal(true)
            }}
          >
            Add Student
          </Button>
        </div>

        <Card className="p-3 border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Bulk Upload (Excel)</h2>
              <p className="text-xs text-gray-600">Upload many students with template file</p>
            </div>
            <Button variant="secondary" onClick={() => setShowBulkUpload((prev) => !prev)}>
              {showBulkUpload ? 'Hide' : 'Show'}
            </Button>
          </div>

          {showBulkUpload ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <Link
                  href="/api/students/bulk-upload/template"
                  title="Download Excel template"
                  aria-label="Download Excel template"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  ⬇️
                </Link>
                <Button
                  onClick={handleExcelUpload}
                  isLoading={uploading}
                  title="Upload selected Excel file"
                  aria-label="Upload selected Excel file"
                  className="h-9 w-9 p-0"
                >
                  ⬆️
                </Button>
              </div>

              <p className="text-xs text-gray-600">
                Required: firstName, lastName, className or classId. Optional: admissionNumber, dateOfBirth,
                parentName, parentEmail, parentPhone.
              </p>

              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-2">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </div>

              {uploadSummary ? (
                <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                  <p className="font-medium text-slate-900">
                    Upload result: {uploadSummary.created} created, {uploadSummary.failed} failed
                  </p>
                  {uploadErrors.length > 0 ? (
                    <ul className="mt-1 list-disc pl-5 text-rose-700 space-y-1">
                      {uploadErrors.map((errorLine, index) => (
                        <li key={`${errorLine}-${index}`}>{errorLine}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card className="p-3">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
            <div className="w-full lg:max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search students</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, admission number, class, parent name or email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
            </div>
            <div className="w-full lg:w-56">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              >
                <option value="">All classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full lg:w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rows per page</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </Card>

        {loading ? (
          <div>Loading students...</div>
        ) : students.length > 0 ? (
          <>
            <div className="overflow-x-auto overflow-y-visible">
              <table className="min-w-full bg-white border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admission No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-16">Actions</th>
                </tr>
              </thead>
                <tbody className="divide-y divide-gray-200">
                  {students.map((student) => {
                  return (
                    <tr key={student.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {student.admissionNumber || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        <Link href={`/admin/students/${student.id}`} className="text-blue-700 hover:underline">
                          {student.firstName} {student.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {student.class?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right relative">
                        <button
                          type="button"
                          aria-label="Student actions"
                          className="h-7 w-7 rounded hover:bg-gray-100"
                          onClick={() =>
                            setOpenActionMenuId((prev) => (prev === student.id ? null : student.id))
                          }
                        >
                          ⋮
                        </button>
                        {openActionMenuId === student.id ? (
                          <div className="absolute right-3 mt-1 w-56 rounded-md border border-gray-200 bg-white shadow-lg z-50 text-left overflow-hidden">
                            <Link
                              href={`/admin/students/${student.id}`}
                              className="flex w-full items-center justify-start px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                              onClick={() => setOpenActionMenuId(null)}
                            >
                              View Details
                            </Link>
                            <button
                              type="button"
                              className="flex w-full items-center justify-start px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                              onClick={() => {
                                setOpenActionMenuId(null)
                                handleEdit(student)
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center justify-start px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                              onClick={() => {
                                setOpenActionMenuId(null)
                                handleResetParentPassword(student)
                              }}
                            >
                              Reset Parent Password
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center justify-start px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setOpenActionMenuId(null)
                                handleDelete(student.id)
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )
                  })}
                </tbody>
              </table>
            </div>

            {totalCount > 0 ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)}-
                  {Math.min((currentPage - 1) * pageSize + students.length, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : (
              <Card className="p-6">
                <p className="text-center text-gray-500">No students match your search.</p>
              </Card>
            )}
          </>
        ) : (
          <Card className="p-6">
            <p className="text-center text-gray-500">
              {searchTerm.trim()
                ? 'No students match your search.'
                : 'No students found. Click "Add Student" to create one.'}
            </p>
          </Card>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">{editingStudent ? 'Edit Student' : 'Add Student'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                </div>

                <Input
                  label="Admission Number"
                  value={formData.admissionNumber}
                  onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
                />

                <Input
                  label="Date of Birth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                />

                <Select
                  label="Primary Class"
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  required
                >
                  <option value="">Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </Select>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Parent Name"
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                  />
                  <Input
                    label="Parent Email (optional)"
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                  />
                </div>

                <Input
                  label="Parent Phone (optional)"
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
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
                  <Button type="submit">{editingStudent ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
