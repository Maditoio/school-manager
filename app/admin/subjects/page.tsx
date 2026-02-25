'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { Barcode, MoreHorizontal, PencilLine, Trash2 } from 'lucide-react'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'

interface Subject {
  id: string
  name: string
  code: string
}

export default function SubjectsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkUploadLoading, setBulkUploadLoading] = useState(false)
  const [bulkUploadErrors, setBulkUploadErrors] = useState<Array<{ row: number; error: string }>>([])
  const [openSubjectMenuId, setOpenSubjectMenuId] = useState<string | null>(null)
  const subjectMenuRef = useRef<HTMLDivElement | null>(null)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
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

  const tAdmin = useCallback((key: string, fallback: string) => adminUi[key] || fallback, [adminUi])
  const tCommon = useCallback((key: string, fallback: string) => common[key] || fallback, [common])

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
      fetchSubjects()
    }
  }, [session])

  useEffect(() => {
    if (!openSubjectMenuId) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!subjectMenuRef.current) return
      if (!subjectMenuRef.current.contains(event.target as Node)) {
        setOpenSubjectMenuId(null)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenSubjectMenuId(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openSubjectMenuId])

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/subjects')
      if (res.ok) {
        const data = await res.json()
        setSubjects(Array.isArray(data.subjects) ? data.subjects : [])
      } else {
        setSubjects([])
      }
    } catch (error) {
      console.error('Failed to fetch subjects:', error)
      setSubjects([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingSubject ? `/api/subjects/${editingSubject.id}` : '/api/subjects'
      const method = editingSubject ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        await fetchSubjects()
        setShowModal(false)
        resetForm()
        showToast(tAdmin('subjectSaved', 'Subject saved successfully!'), 'success')
      } else {
        const error = await res.json()
        showToast(error.error || tAdmin('failedSaveSubject', 'Failed to save subject'), 'error')
      }
    } catch (error) {
      console.error('Failed to save subject:', error)
      showToast(tAdmin('failedSaveSubject', 'Failed to save subject'), 'error')
    }
  }

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject)
    setFormData({
      name: subject.name,
      code: subject.code,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(tAdmin('confirmDeleteSubject', 'Are you sure you want to delete this subject?'))) return

    try {
      const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchSubjects()
        showToast(tAdmin('subjectDeleted', 'Subject deleted successfully!'), 'success')
      } else {
        const error = await res.json()
        showToast(error.error || tAdmin('failedDeleteSubject', 'Failed to delete subject'), 'error')
      }
    } catch (error) {
      console.error('Failed to delete subject:', error)
      showToast(tAdmin('failedDeleteSubject', 'Failed to delete subject'), 'error')
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

      const res = await fetch('/api/subjects/bulk-upload', {
        method: 'POST',
        body: formDataToSend,
      })

      const data = await res.json()

      if (res.ok) {
        await fetchSubjects()
        setShowBulkModal(false)
        showToast(`Successfully created ${data.created} subject(s)!`, 'success')
      } else {
        if (data.errors && data.errors.length > 0) {
          setBulkUploadErrors(data.errors)
          showToast(`Failed to create ${data.failed} row(s). See errors below.`, 'error')
        } else {
          showToast(data.error || tAdmin('failedUploadSubjects', 'Failed to upload subjects'), 'error')
        }
      }
    } catch (error) {
      console.error('Failed to upload subjects:', error)
      showToast(tAdmin('failedUploadSubjects', 'Failed to upload subjects'), 'error')
    } finally {
      setBulkUploadLoading(false)
    }
  }

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/api/subjects/bulk-upload/template')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'subjects-bulk-upload-template.xlsx'
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
      code: '',
    })
    setEditingSubject(null)
  }

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
            <h1 className="text-3xl font-bold text-gray-900">{tAdmin('subjectsManagement', 'Subjects Management')}</h1>
            <p className="text-gray-600 mt-2">{tAdmin('manageSubjectCatalog', 'Manage your school subject catalog. Assign subjects to classes from Classes page.')}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowBulkModal(true)
                setBulkUploadErrors([])
              }}
            >
              {tAdmin('bulkUploadSubjects', 'Bulk Upload Subjects')}
            </Button>
            <Button
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
            >
              {tAdmin('addSubject', 'Add Subject')}
            </Button>
          </div>
        </div>

        {loading ? (
          <div>{tAdmin('loadingSubjects', 'Loading subjects...')}</div>
        ) : subjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((subject) => (
              <Card key={subject.id} className={`p-6 relative ${openSubjectMenuId === subject.id ? 'z-30' : 'z-0'}`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2" ref={openSubjectMenuId === subject.id ? subjectMenuRef : undefined}>
                    <h3 className="text-xl font-semibold text-gray-900">{subject.name}</h3>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label="Subject actions"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--border-subtle) bg-(--surface-soft) ui-text-secondary hover:ui-text-primary"
                        onClick={() => setOpenSubjectMenuId((prev) => (prev === subject.id ? null : subject.id))}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {openSubjectMenuId === subject.id ? (
                        <div className="absolute right-0 top-9 z-50 min-w-40 rounded-[10px] border border-(--border-subtle) bg-(--surface) p-1.5 shadow-(--shadow-soft)">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ui-text-secondary hover:bg-(--surface-soft) hover:ui-text-primary"
                            onClick={() => {
                              setOpenSubjectMenuId(null)
                              handleEdit(subject)
                            }}
                          >
                            <PencilLine className="h-4 w-4" />
                            {tCommon('edit', 'Edit')}
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              setOpenSubjectMenuId(null)
                              handleDelete(subject.id)
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
                      <Barcode className="h-4 w-4" />
                      {tAdmin('code', 'Code:')} {subject.code}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-gray-500">{tAdmin('noSubjects', 'No subjects found. Click "Add Subject" to create one.')}</p>
          </Card>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md p-6">
              <h2 className="text-2xl font-bold mb-4">
                {editingSubject ? tAdmin('editSubject', 'Edit Subject') : tAdmin('addSubject', 'Add Subject')}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label={tAdmin('subjectName', 'Subject Name')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder={tAdmin('egMathematics', 'e.g., Mathematics')}
                />
                <Input
                  label={tAdmin('subjectCode', 'Subject Code')}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                  placeholder={tAdmin('egMath101', 'e.g., MATH101')}
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
                  <Button type="submit">{editingSubject ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {showBulkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">{tAdmin('bulkUploadSubjects', 'Bulk Upload Subjects')}</h2>

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
                    {tAdmin('subjectsTemplateHelp', 'Download the Excel template, fill it with subject details, then upload it here.')}
                  </p>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleBulkUpload}
                    disabled={bulkUploadLoading}
                    className="hidden"
                    id="bulk-file-input-subjects"
                  />
                  <label htmlFor="bulk-file-input-subjects" className="cursor-pointer">
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
