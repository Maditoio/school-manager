'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { BookOpen, CalendarDays, GraduationCap, MoreHorizontal, PencilLine, Trash2, UserRound, Users } from 'lucide-react'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'

interface Class {
  id: string
  name: string
  academicYear: number
  teacherId: string | null
  capacity?: number | null
  teacher?: { firstName: string; lastName: string }
  _count?: { students: number }
}

interface Teacher {
  id: string
  firstName: string
  lastName: string
}

export default function ClassesPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [classes, setClasses] = useState<Class[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkUploadLoading, setBulkUploadLoading] = useState(false)
  const [bulkUploadErrors, setBulkUploadErrors] = useState<Array<{ row: number; error: string }>>([])
  const [openClassMenuId, setOpenClassMenuId] = useState<string | null>(null)
  const classMenuRef = useRef<HTMLDivElement | null>(null)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    academicYear: new Date().getFullYear().toString(),
    teacherId: '',
    capacity: '',
  })

  const preferredLanguage = session?.user?.preferredLanguage || 'en'

  const languageMessages = useMemo(() => {
    return preferredLanguage === 'fr' ? frMessages : preferredLanguage === 'sw' ? swMessages : enMessages
  }, [preferredLanguage])

  const adminUi = useMemo(
    () => ((languageMessages as Record<string, unknown>).adminUi || {}) as Record<string, string>,
    [languageMessages]
  )

  const common = useMemo(
    () => ((languageMessages as Record<string, unknown>).common || {}) as Record<string, string>,
    [languageMessages]
  )

  const navigation = useMemo(
    () => ((languageMessages as Record<string, unknown>).navigation || {}) as Record<string, string>,
    [languageMessages]
  )

  const tAdmin = useCallback((key: string, fallback: string) => adminUi[key] || fallback, [adminUi])
  const tCommon = useCallback((key: string, fallback: string) => common[key] || fallback, [common])
  const tNav = useCallback((key: string, fallback: string) => navigation[key] || fallback, [navigation])

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
      fetchTeachers()
    }
  }, [session])

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
    } finally {
      setLoading(false)
    }
  }

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
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingClass ? `/api/classes/${editingClass.id}` : '/api/classes'
      const method = editingClass ? 'PUT' : 'POST'

      const payload = {
        name: formData.name,
        academicYear: formData.academicYear,
        teacherId: formData.teacherId || undefined,
        capacity: formData.capacity || undefined,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        await fetchClasses()
        setShowModal(false)
        resetForm()
        showToast(tAdmin('classSaved', 'Class saved successfully!'), 'success')
      } else {
        const error = await res.json()
        const apiError =
          Array.isArray(error.error) && error.error[0]?.message
            ? String(error.error[0].message)
            : typeof error.error === 'string'
              ? error.error
              : tAdmin('failedSaveClass', 'Failed to save class')
        showToast(apiError, 'error')
      }
    } catch (error) {
      console.error('Failed to save class:', error)
      showToast(tAdmin('failedSaveClass', 'Failed to save class'), 'error')
    }
  }

  const handleEdit = (cls: Class) => {
    setEditingClass(cls)
    setFormData({
      name: cls.name,
      academicYear: cls.academicYear.toString(),
      teacherId: cls.teacherId || '',
      capacity: cls.capacity ? cls.capacity.toString() : '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(tAdmin('confirmDeleteClass', 'Are you sure you want to delete this class?'))) return

    try {
      const res = await fetch(`/api/classes/${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (res.ok || res.status === 202) {
        showToast(
          data.message ||
            tAdmin('classDeletionRequested', 'Class deletion request submitted. Awaiting approval from another admin.'),
          'success'
        )
        await fetchClasses()
      } else {
        showToast(data.error || tAdmin('failedDeleteClass', 'Failed to delete class'), 'error')
      }
    } catch (error) {
      console.error('Failed to delete class:', error)
      showToast(tAdmin('failedDeleteClass', 'Failed to delete class'), 'error')
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

      const res = await fetch('/api/classes/bulk-upload', {
        method: 'POST',
        body: formDataToSend,
      })

      const data = await res.json()

      if (res.ok) {
        await fetchClasses()
        setShowBulkModal(false)
        showToast(`Successfully created ${data.created} class(es)!`, 'success')
      } else {
        if (data.errors && data.errors.length > 0) {
          setBulkUploadErrors(data.errors)
          showToast(`Failed to create ${data.failed} row(s). See errors below.`, 'error')
        } else {
          showToast(data.error || tAdmin('failedUploadClasses', 'Failed to upload classes'), 'error')
        }
      }
    } catch (error) {
      console.error('Failed to upload classes:', error)
      showToast(tAdmin('failedUploadClasses', 'Failed to upload classes'), 'error')
    } finally {
      setBulkUploadLoading(false)
    }
  }

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/api/classes/bulk-upload/template')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'classes-bulk-upload-template.xlsx'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to download template:', error)
      showToast(tAdmin('failedDownloadTemplate', 'Failed to download template'), 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      academicYear: new Date().getFullYear().toString(),
      teacherId: '',
      capacity: '',
    })
    setEditingClass(null)
  }

  useEffect(() => {
    if (!openClassMenuId) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!classMenuRef.current) return
      if (!classMenuRef.current.contains(event.target as Node)) {
        setOpenClassMenuId(null)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenClassMenuId(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openClassMenuId])

  if (status === 'loading' || !session) {
    return <div>{tCommon('loading', 'Loading...')}</div>
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
            <h1 className="text-3xl font-bold text-gray-900">{tAdmin('classesManagement', 'Classes Management')}</h1>
            <p className="text-gray-600 mt-2">{tAdmin('manageClasses', 'Manage all classes in your school')}</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/admin/deletion-requests"
              className="ui-button ui-button-secondary h-8 px-3.5 text-[13px] inline-flex items-center justify-center"
            >
              {tAdmin('deletionRequests', 'Deletion Requests')}
            </a>
            <Button
              variant="secondary"
              onClick={() => {
                setShowBulkModal(true)
                setBulkUploadErrors([])
              }}
            >
              {tAdmin('bulkUploadClasses', 'Bulk Upload Classes')}
            </Button>
            <Button
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
            >
              {tAdmin('addClass', 'Add Class')}
            </Button>
          </div>
        </div>

        {loading ? (
          <div>{tAdmin('loadingClasses', 'Loading classes...')}</div>
        ) : classes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <Card key={cls.id} className={`p-6 relative ${openClassMenuId === cls.id ? 'z-30' : 'z-0'}`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2" ref={openClassMenuId === cls.id ? classMenuRef : undefined}>
                    <h3 className="text-xl font-semibold text-gray-900">{cls.name}</h3>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label="Class actions"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--border-subtle) bg-(--surface-soft) ui-text-secondary hover:ui-text-primary"
                        onClick={() => setOpenClassMenuId((prev) => (prev === cls.id ? null : cls.id))}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {openClassMenuId === cls.id ? (
                        <div className="absolute right-0 top-9 z-50 min-w-40 rounded-[10px] border border-(--border-subtle) bg-(--surface) p-1.5 shadow-(--shadow-soft)">
                          <a
                            href={`/admin/classes/${cls.id}/students`}
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm ui-text-secondary hover:bg-(--surface-soft) hover:ui-text-primary"
                            onClick={() => setOpenClassMenuId(null)}
                          >
                            <GraduationCap className="h-4 w-4" />
                            {tNav('students', 'Students')}
                          </a>
                          <a
                            href={`/admin/classes/${cls.id}/subjects`}
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm ui-text-secondary hover:bg-(--surface-soft) hover:ui-text-primary"
                            onClick={() => setOpenClassMenuId(null)}
                          >
                            <BookOpen className="h-4 w-4" />
                            {tNav('subjects', 'Subjects')}
                          </a>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ui-text-secondary hover:bg-(--surface-soft) hover:ui-text-primary"
                            onClick={() => {
                              setOpenClassMenuId(null)
                              handleEdit(cls)
                            }}
                          >
                            <PencilLine className="h-4 w-4" />
                            {tCommon('edit', 'Edit')}
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              setOpenClassMenuId(null)
                              handleDelete(cls.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            {tCommon('delete', 'Delete')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {tAdmin('year', 'Year:')} {cls.academicYear}
                    </p>
                    <p className="flex items-center gap-2">
                      <UserRound className="h-4 w-4" />
                      {tAdmin('teacher', 'Teacher:')} {cls.teacher ? `${cls.teacher.firstName} ${cls.teacher.lastName}` : tAdmin('na', 'N/A')}
                    </p>
                    <p className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {tAdmin('students', 'Students:')} {cls._count?.students || 0}
                      {cls.capacity ? ` / ${cls.capacity}` : ''}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-gray-500">{tAdmin('noClasses', 'No classes found. Click "Add Class" to create one.')}</p>
          </Card>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md p-6">
              <h2 className="text-2xl font-bold mb-4">
                {editingClass ? tAdmin('editClass', 'Edit Class') : tAdmin('addClass', 'Add Class')}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label={tAdmin('className', 'Class Name')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder={tAdmin('egGrade', 'e.g., Grade 5A')}
                />
                <Input
                  label={tAdmin('academicYear', 'Academic Year')}
                  type="number"
                  value={formData.academicYear}
                  onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                  required
                  min={new Date().getFullYear() - 5}
                  max={new Date().getFullYear() + 5}
                />
                <Select
                  label={tAdmin('classTeacher', 'Class Teacher')}
                  value={formData.teacherId}
                  onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                >
                  <option value="">{tAdmin('assignLater', 'Assign later')}</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.firstName} {teacher.lastName}
                    </option>
                  ))}
                </Select>
                <Input
                  label={tAdmin('classCapacity', 'Class Capacity')}
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  min={1}
                  max={500}
                  placeholder={tAdmin('egCapacity', 'e.g., 40')}
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
                    {tCommon('cancel', 'Cancel')}
                  </Button>
                  <Button type="submit">{editingClass ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {showBulkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">{tAdmin('bulkUploadClasses', 'Bulk Upload Classes')}</h2>

              <div className="space-y-4">
                <div>
                  <Button 
                    variant="secondary" 
                    onClick={downloadTemplate}
                    className="mb-4"
                  >
                    {tAdmin('downloadTemplate', 'Download Template')}
                  </Button>
                  <p className="text-sm text-gray-600 mb-4">
                    {tAdmin('classesTemplateHelp', 'Download the Excel template, fill it with class details, then upload it here.')}
                  </p>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleBulkUpload}
                    disabled={bulkUploadLoading}
                    className="hidden"
                    id="bulk-file-input-classes"
                  />
                  <label htmlFor="bulk-file-input-classes" className="cursor-pointer">
                    <div className="text-4xl mb-2">📁</div>
                    <p className="text-gray-700 font-medium">
                      {bulkUploadLoading ? tAdmin('uploading', 'Uploading...') : tAdmin('clickUploadOrDrag', 'Click to upload or drag and drop')}
                    </p>
                    <p className="text-sm text-gray-500">{tAdmin('excelMax5mb', 'Excel files (.xlsx, .xls) - Max 5MB')}</p>
                  </label>
                </div>

                {bulkUploadErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-900 mb-2">{tAdmin('uploadErrors', 'Upload Errors')}</h3>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {bulkUploadErrors.map((err, idx) => (
                        <p key={idx} className="text-sm text-red-700">
                          <strong>{tAdmin('row', 'Row')} {err.row}:</strong> {err.error}
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
                    {tCommon('cancel', 'Close')}
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
