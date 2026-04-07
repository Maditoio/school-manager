'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import Table from '@/components/ui/Table'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

interface Student {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  admissionNumber: string | null
  status: 'ACTIVE' | 'LEFT'
  statusReason?: 'SUSPENSION' | 'GRADUATION' | 'TRANSFERRED_SCHOOL' | 'OTHER' | null
  statusDate?: string | null
  statusNotes?: string | null
  classId: string
  class?: { id: string; name: string }
  parentId: string | null
  parentName?: string | null
  parentEmail?: string | null
  parentPhone?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
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
  const [selectedStatusReason, setSelectedStatusReason] = useState('')
  const [statusDateFrom, setStatusDateFrom] = useState('')
  const [statusDateTo, setStatusDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const [totalCount, setTotalCount] = useState(0)

  const [showModal, setShowModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusTargetStudent, setStatusTargetStudent] = useState<Student | null>(null)
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [emergencyTargetStudent, setEmergencyTargetStudent] = useState<Student | null>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadSummary, setUploadSummary] = useState<{ created: number; skipped: number; failed: number } | null>(null)
  const [uploadSkipped, setUploadSkipped] = useState<string[]>([])
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [formSaving, setFormSaving] = useState(false)
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

  const [statusFormData, setStatusFormData] = useState({
    status: 'LEFT' as 'ACTIVE' | 'LEFT',
    reason: 'SUSPENSION' as 'SUSPENSION' | 'GRADUATION' | 'TRANSFERRED_SCHOOL' | 'OTHER',
    effectiveAt: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const [emergencyFormData, setEmergencyFormData] = useState({
    emergencyContactName: '',
    emergencyContactPhone: '',
  })

  const preferredLanguage = session?.user?.preferredLanguage || 'en'
  const studentsPageMessages = useMemo(() => {
    const currentMessages =
      preferredLanguage === 'fr' ? frMessages : preferredLanguage === 'sw' ? swMessages : enMessages
    return (currentMessages as Record<string, unknown>).studentsPage as Record<string, string> | undefined
  }, [preferredLanguage])

  const t = useCallback(
    (key: string, fallback: string) => studentsPageMessages?.[key] || fallback,
    [studentsPageMessages]
  )

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
      fetchClasses()
    }
  }, [session])

  const fetchStudents = useCallback(async (
    page = currentPage,
    size = pageSize,
    query = searchTerm,
    classFilter = selectedClassId,
    reasonFilter = selectedStatusReason,
    dateFromFilter = statusDateFrom,
    dateToFilter = statusDateTo
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

      if (reasonFilter) {
        params.set('statusReason', reasonFilter)
      }

      if (dateFromFilter) {
        params.set('statusDateFrom', dateFromFilter)
      }

      if (dateToFilter) {
        params.set('statusDateTo', dateToFilter)
      }

      const res = await fetch(`/api/students?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setStudents(Array.isArray(data.students) ? data.students : [])

        const pagination = data.pagination
        if (pagination) {
          setTotalCount(Number(pagination.totalCount) || 0)

          const serverPage = Number(pagination.page) || 1
          if (serverPage !== page) {
            setCurrentPage(serverPage)
          }
        } else {
          const count = Array.isArray(data.students) ? data.students.length : 0
          setTotalCount(count)
        }
      } else {
        setStudents([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error('Failed to fetch students:', error)
      setStudents([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, searchTerm, selectedClassId, selectedStatusReason, statusDateFrom, statusDateTo])

  useEffect(() => {
    if (session) {
      fetchStudents(
        currentPage,
        pageSize,
        searchTerm,
        selectedClassId,
        selectedStatusReason,
        statusDateFrom,
        statusDateTo
      )
    }
  }, [session, currentPage, pageSize, searchTerm, selectedClassId, selectedStatusReason, statusDateFrom, statusDateTo, fetchStudents])

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
      setFormSaving(true)
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
        await fetchStudents(
          currentPage,
          pageSize,
          searchTerm,
          selectedClassId,
          selectedStatusReason,
          statusDateFrom,
          statusDateTo
        )
        setShowModal(false)
        resetForm()
        showToast(
          editingStudent
            ? t('toastStudentUpdated', 'Student updated successfully')
            : t('toastStudentCreated', 'Student created successfully'),
          'success'
        )
      } else {
        const error = await res.json()
        showToast(error.error || t('toastFailedSaveStudent', 'Failed to save student'), 'error')
      }
    } catch (error) {
      console.error('Failed to save student:', error)
      showToast(t('toastFailedSaveStudent', 'Failed to save student'), 'error')
    } finally {
      setFormSaving(false)
    }
  }

  const handleExcelUpload = async () => {
    if (!uploadFile) {
      showToast(t('toastChooseExcel', 'Please choose an Excel file'), 'warning')
      return
    }

    if (uploadFile.size > 5 * 1024 * 1024) {
      showToast(t('toastFileTooLarge', 'File is too large. Maximum supported size is 5MB.'), 'error')
      return
    }

    setUploadSummary(null)
    setUploadSkipped([])
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
      let result: {
        error?: string
        message?: string
        created?: number
        skipped?: number
        failed?: number
        skippedRows?: Array<{ row: number; reason: string }>
        errors?: Array<{ row: number; error: string }>
      } = {}

      try {
        result = responseText ? JSON.parse(responseText) : {}
      } catch {
        result = {}
      }

      if (!res.ok) {
        const detailedSkips = Array.isArray(result.skippedRows)
          ? result.skippedRows.slice(0, 10).map((item) => `Row ${item.row}: ${item.reason}`)
          : []
        const detailedErrors = Array.isArray(result.errors)
          ? result.errors.slice(0, 10).map((item) => `Row ${item.row}: ${item.error}`)
          : []

        setUploadSummary({ created: result.created || 0, skipped: result.skipped || 0, failed: result.failed || 0 })
        setUploadSkipped(detailedSkips)
        setUploadErrors(detailedErrors)
        showToast(result.error || result.message || t('toastBulkFailed', 'Bulk upload failed'), 'error')
        return
      }

      await fetchStudents(
        currentPage,
        pageSize,
        searchTerm,
        selectedClassId,
        selectedStatusReason,
        statusDateFrom,
        statusDateTo
      )
      setUploadFile(null)
      const created = result.created || 0
      const skipped = result.skipped || 0
      const failed = result.failed || 0
      const detailedSkips = Array.isArray(result.skippedRows)
        ? result.skippedRows.slice(0, 10).map((item) => `Row ${item.row}: ${item.reason}`)
        : []
      const detailedErrors = Array.isArray(result.errors)
        ? result.errors.slice(0, 10).map((item) => `Row ${item.row}: ${item.error}`)
        : []

      setUploadSummary({ created, skipped, failed })
      setUploadSkipped(detailedSkips)
      setUploadErrors(detailedErrors)

      if (failed > 0) {
        showToast(`${t('toastUploadProcessed', 'Upload processed')}: ${created} ${t('created', 'created')}, ${skipped} ${t('skipped', 'skipped')}, ${failed} ${t('failed', 'failed')}`, created > 0 ? 'warning' : 'error')
      } else if (skipped > 0) {
        showToast(`${t('toastUploadProcessed', 'Upload processed')}: ${created} ${t('created', 'created')}, ${skipped} ${t('skipped', 'skipped')}`, 'warning')
      } else {
        showToast(`${t('toastUploadComplete', 'Upload complete')}: ${created} ${t('created', 'created')}`, 'success')
      }
    } catch (error) {
      console.error('Failed to upload students:', error)
      showToast(t('toastNetworkUploadError', 'Network error during upload. Please refresh and try again.'), 'error')
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

  const handleResetParentPassword = async (student: Student) => {
    if (!student.parentId) {
      showToast(t('toastNoParentLinked', 'No linked parent account for this student'), 'warning')
      return
    }

    const newPassword = prompt(`Enter a temporary password for parent of ${student.firstName} ${student.lastName} (min 6 chars):`)
    if (!newPassword) return

    if (newPassword.length < 6) {
      showToast(t('toastPasswordMin', 'Password must be at least 6 characters'), 'error')
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
        showToast(data.error || t('toastFailedResetParentPassword', 'Failed to reset parent password'), 'error')
        return
      }

      showToast(t('toastParentResetSuccess', 'Parent password reset. Parent must change it on first login.'), 'success')
    } catch (error) {
      console.error('Failed to reset parent password:', error)
      showToast(t('toastFailedResetParentPassword', 'Failed to reset parent password'), 'error')
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

  const fetchNextAdmissionNumber = useCallback(async (classId: string) => {
    if (!classId) {
      setFormData((prev) => ({ ...prev, admissionNumber: '' }))
      return
    }

    try {
      const res = await fetch(`/api/students/next-admission?classId=${encodeURIComponent(classId)}`)
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        showToast(errorBody.error || t('toastFailedAdmission', 'Failed to generate admission number'), 'warning')
        return
      }

      const payload = await res.json()
      if (payload?.admissionNumber) {
        setFormData((prev) => ({ ...prev, admissionNumber: payload.admissionNumber }))
      }
    } catch (error) {
      console.error('Failed to fetch next admission number:', error)
    }
  }, [showToast, t])

  const handleClassChangeInForm = (classId: string) => {
    setFormData((prev) => ({ ...prev, classId }))
    if (!editingStudent) {
      fetchNextAdmissionNumber(classId)
    }
  }

  const resetStatusForm = () => {
    setStatusFormData({
      status: 'LEFT',
      reason: 'SUSPENSION',
      effectiveAt: new Date().toISOString().split('T')[0],
      notes: '',
    })
  }

  const handleOpenStatusModal = (student: Student) => {
    setStatusTargetStudent(student)
    setStatusFormData({
      status: student.status,
      reason: student.statusReason || 'SUSPENSION',
      effectiveAt: student.statusDate ? student.statusDate.split('T')[0] : new Date().toISOString().split('T')[0],
      notes: student.statusNotes || '',
    })
    setShowStatusModal(true)
  }

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!statusTargetStudent) return

    if (statusFormData.status === 'LEFT' && !statusFormData.reason) {
      showToast(t('toastSelectReason', 'Please select a reason for leaving'), 'warning')
      return
    }

    try {
      const statusPayload = {
        status: statusFormData.status,
        reason: statusFormData.status === 'LEFT' ? statusFormData.reason : undefined,
        effectiveAt: statusFormData.effectiveAt,
        notes: statusFormData.notes || undefined,
      }

      const res = await fetch(`/api/students/${statusTargetStudent.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusPayload),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        console.error('Status update failed', {
          studentId: statusTargetStudent.id,
          httpStatus: res.status,
          response: error,
          payload: statusPayload,
        })

        const combinedMessage = [error.error, error.details, error.requestId ? `Ref: ${error.requestId}` : '']
          .filter(Boolean)
          .join(' • ')

        showToast(combinedMessage || t('toastFailedStatusUpdate', 'Failed to update student status'), 'error')
        return
      }

      await fetchStudents(
        currentPage,
        pageSize,
        searchTerm,
        selectedClassId,
        selectedStatusReason,
        statusDateFrom,
        statusDateTo
      )
      setShowStatusModal(false)
      setStatusTargetStudent(null)
      resetStatusForm()
      showToast(t('toastStatusUpdated', 'Student status updated successfully'), 'success')
    } catch (error) {
      console.error('Failed to update student status:', error)
      showToast(t('toastFailedStatusUpdate', 'Failed to update student status'), 'error')
    }
  }

  const handleOpenEmergencyModal = (student: Student) => {
    setEmergencyTargetStudent(student)
    setEmergencyFormData({
      emergencyContactName: student.emergencyContactName || '',
      emergencyContactPhone: student.emergencyContactPhone || '',
    })
    setShowEmergencyModal(true)
  }

  const resetEmergencyForm = () => {
    setEmergencyFormData({
      emergencyContactName: '',
      emergencyContactPhone: '',
    })
  }

  const handleEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!emergencyTargetStudent) return

    if (!emergencyFormData.emergencyContactPhone.trim()) {
      showToast(t('toastEmergencyPhoneRequired', 'Emergency contact phone is required'), 'warning')
      return
    }

    try {
      const payload = {
        emergencyContactName: emergencyFormData.emergencyContactName || undefined,
        emergencyContactPhone: emergencyFormData.emergencyContactPhone,
      }

      const res = await fetch(`/api/students/${emergencyTargetStudent.id}/emergency-contact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        showToast(error.error || t('toastFailedEmergencyUpdate', 'Failed to update emergency contact'), 'error')
        return
      }

      await fetchStudents(
        currentPage,
        pageSize,
        searchTerm,
        selectedClassId,
        selectedStatusReason,
        statusDateFrom,
        statusDateTo
      )
      setShowEmergencyModal(false)
      setEmergencyTargetStudent(null)
      resetEmergencyForm()
      showToast(t('toastEmergencyUpdated', 'Emergency contact updated successfully'), 'success')
    } catch (error) {
      console.error('Failed to update emergency contact:', error)
      showToast(t('toastFailedEmergencyUpdate', 'Failed to update emergency contact'), 'error')
    }
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedClassId, selectedStatusReason, statusDateFrom, statusDateTo, pageSize])

  if (status === 'loading' || !session) {
    return <div>{t('loading', 'Loading...')}</div>
  }

  const studentColumns = [
    {
      key: 'admissionNumber',
      label: t('tableAdmissionNo', 'Admission No'),
      sortable: true,
      renderCell: (student: Student) => student.admissionNumber || '-',
    },
    {
      key: 'student',
      label: t('tableName', 'Name'),
      sortable: true,
      renderCell: (student: Student) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xs font-semibold text-slate-100">
            {`${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase() || 'S'}
          </div>
          <div className="flex flex-col">
            <Link href={`/admin/students/${student.id}`} className="font-medium text-indigo-200 hover:underline">
              {student.firstName} {student.lastName}
            </Link>
            <span className="text-xs text-slate-400">
              {student.parentEmail || t('parentEmailOptional', 'Parent Email (optional)')}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'className',
      label: t('tableClass', 'Class'),
      sortable: true,
      renderCell: (student: Student) => student.class?.name || 'N/A',
    },
    {
      key: 'status',
      label: t('tableStatus', 'Status'),
      sortable: true,
      renderCell: (student: Student) =>
        student.status === 'LEFT' ? t('leftSchool', 'Left School') : t('active', 'Active'),
    },
    {
      key: 'actions',
      label: t('tableActions', 'Actions'),
    },
  ]

  const studentRowActions = (student: Student) => [
    {
      label: t('viewDetails', 'View Details'),
      onClick: () => {
        window.location.href = `/admin/students/${student.id}`
      },
    },
    {
      label: t('edit', 'Edit'),
      onClick: () => {
        handleEdit(student)
      },
    },
    {
      label: t('updateStatus', 'Update Status'),
      onClick: () => {
        handleOpenStatusModal(student)
      },
    },
    {
      label: t('updateEmergencyContact', 'Update Emergency Contact'),
      onClick: () => {
        handleOpenEmergencyModal(student)
      },
    },
    {
      label: t('resetParentPassword', 'Reset Parent Password'),
      onClick: () => {
        handleResetParentPassword(student)
      },
    },
  ]

  const navItems = session?.user?.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session?.user?.role === 'DEPUTY_ADMIN' ? 'Deputy Admin' : 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-[24px] font-bold ui-text-primary">{t('pageTitle', 'Students Management')}</h1>
            <p className="mt-1 ui-text-secondary">{t('pageSubtitle', 'Manage students, classes, and parent contacts')}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowBulkUpload(true)
                setUploadSummary(null)
                setUploadSkipped([])
                setUploadErrors([])
                setUploadFile(null)
              }}
            >
              {t('bulkUpload', 'Bulk Upload')}
            </Button>
            <Button
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
            >
              {t('enrollStudent', 'Enroll Student')}
            </Button>
          </div>
        </div>

        {loading || students.length > 0 ? (
          <Table
            title={t('pageTitle', 'Students Management')}
            columns={studentColumns}
            data={students}
            loading={loading}
            totalCount={totalCount}
            page={currentPage}
            pageSize={pageSize}
            onSort={() => {
              // Server API currently returns sorted results by backend defaults.
            }}
            onSearch={(value) => {
              setSearchTerm(value)
              setCurrentPage(1)
            }}
            onPageChange={setCurrentPage}
            filterLabel={t('filterByClass', 'Filter by class')}
            filterOptions={[{ value: '', label: t('allClasses', 'All classes') }, ...classes.map((cls) => ({ value: cls.id, label: cls.name }))]}
            activeFilter={selectedClassId}
            onFilterChange={(value) => {
              setSelectedClassId(value)
              setCurrentPage(1)
            }}
            onFilterClick={() => {
              setSelectedStatusReason('')
              setStatusDateFrom('')
              setStatusDateTo('')
            }}
            getRowActions={studentRowActions}
            rowKey="id"
            emptyMessage={
              searchTerm.trim()
                ? t('noSearchResults', 'No students match your search.')
                : t('noStudentsFound', 'No students found. Click "Enroll Student" to create one.')
            }
            ariaLabel={t('pageTitle', 'Students Management')}
          />
        ) : (
          <Card className="p-6">
            <p className="text-center text-gray-500">
              {searchTerm.trim()
                ? t('noSearchResults', 'No students match your search.')
                : t('noStudentsFound', 'No students found. Click "Enroll Student" to create one.')}
            </p>
          </Card>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">{editingStudent ? t('editStudent', 'Edit Student') : t('enrollStudent', 'Enroll Student')}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t('firstName', 'First Name')}
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                  <Input
                    label={t('lastName', 'Last Name')}
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>

                <Input
                  label={t('admissionNumber', 'Admission Number')}
                  value={formData.admissionNumber}
                  disabled
                  readOnly
                />

                <Input
                  label={t('dateOfBirth', 'Date of Birth')}
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                />

                <Select
                  label={t('primaryClass', 'Primary Class')}
                  value={formData.classId}
                  onChange={(e) => handleClassChangeInForm(e.target.value)}
                  required
                >
                  <option value="">{t('selectClass', 'Select Class')}</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </Select>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label={t('parentName', 'Parent Name')}
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                  />
                  <Input
                    label={t('parentEmailOptional', 'Parent Email (optional)')}
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                  />
                </div>

                <Input
                  label={t('parentPhoneOptional', 'Parent Phone (optional)')}
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
                    {t('cancel', 'Cancel')}
                  </Button>
                  <Button type="submit" isLoading={formSaving} disabled={formSaving}>{editingStudent ? t('update', 'Update') : t('create', 'Create')}</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {showBulkUpload ? (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">{t('bulkUploadStudents', 'Bulk Upload Students')}</h2>

              <div className="space-y-4">
                <div>
                  <Button variant="secondary" className="mb-4">
                    <Link href="/api/students/bulk-upload/template">{t('downloadTemplate', 'Download Template')}</Link>
                  </Button>
                  <p className="text-sm ui-text-secondary">
                    {t('bulkRequirements', 'Required: firstName, lastName, className or classId. Optional: dateOfBirth, parentName, parentEmail, parentPhone, emergencyContactName, emergencyContactPhone.')}
                  </p>
                </div>

                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </div>

                {uploadSummary ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <p className="font-medium text-slate-900">
                      {t('uploadResult', 'Upload result')}: {uploadSummary.created} {t('created', 'created')}, {uploadSummary.skipped} {t('skipped', 'skipped')}, {uploadSummary.failed} {t('failed', 'failed')}
                    </p>
                    {uploadSkipped.length > 0 ? (
                      <ul className="mt-2 list-disc pl-5 text-amber-700 space-y-1">
                        {uploadSkipped.map((skipLine, index) => (
                          <li key={`${skipLine}-${index}`}>{skipLine}</li>
                        ))}
                      </ul>
                    ) : null}
                    {uploadErrors.length > 0 ? (
                      <ul className="mt-2 list-disc pl-5 text-rose-700 space-y-1">
                        {uploadErrors.map((errorLine, index) => (
                          <li key={`${errorLine}-${index}`}>{errorLine}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowBulkUpload(false)
                      setUploadSummary(null)
                      setUploadSkipped([])
                      setUploadErrors([])
                      setUploadFile(null)
                    }}
                  >
                    {t('close', 'Close')}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleExcelUpload}
                    isLoading={uploading}
                  >
                    {t('upload', 'Upload')}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {showStatusModal && statusTargetStudent ? (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
            <Card className="w-[min(92vw,30rem)] max-w-none p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-2">{t('updateStudentStatusTitle', 'Update Student Status')}</h2>
              <p className="text-sm text-gray-600 mb-4">
                {statusTargetStudent.firstName} {statusTargetStudent.lastName}
              </p>

              <form onSubmit={handleStatusSubmit} className="space-y-4">
                <Select
                  label={t('status', 'Status')}
                  value={statusFormData.status}
                  onChange={(e) => setStatusFormData((prev) => ({ ...prev, status: e.target.value as 'ACTIVE' | 'LEFT' }))}
                >
                  <option value="ACTIVE">{t('activeCurrentlyEnrolled', 'Active (currently enrolled)')}</option>
                  <option value="LEFT">{t('leftSchoolLower', 'Left school')}</option>
                </Select>

                {statusFormData.status === 'LEFT' ? (
                  <Select
                    label={t('reasonForLeaving', 'Reason for Leaving')}
                    value={statusFormData.reason}
                    onChange={(e) =>
                      setStatusFormData((prev) => ({
                        ...prev,
                        reason: e.target.value as 'SUSPENSION' | 'GRADUATION' | 'TRANSFERRED_SCHOOL' | 'OTHER',
                      }))
                    }
                    required
                  >
                    <option value="SUSPENSION">{t('reasonSuspension', 'Suspension')}</option>
                    <option value="GRADUATION">{t('reasonGraduation', 'Graduation')}</option>
                    <option value="TRANSFERRED_SCHOOL">{t('reasonTransfer', 'Change of school')}</option>
                    <option value="OTHER">{t('reasonOther', 'Other')}</option>
                  </Select>
                ) : null}

                <Input
                  label={t('effectiveDate', 'Effective Date')}
                  type="date"
                  value={statusFormData.effectiveAt}
                  onChange={(e) => setStatusFormData((prev) => ({ ...prev, effectiveAt: e.target.value }))}
                  required
                />

                <Input
                  label={t('notesOptional', 'Notes (optional)')}
                  value={statusFormData.notes}
                  onChange={(e) => setStatusFormData((prev) => ({ ...prev, notes: e.target.value }))}
                />

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowStatusModal(false)
                      setStatusTargetStudent(null)
                      resetStatusForm()
                    }}
                  >
                    {t('cancel', 'Cancel')}
                  </Button>
                  <Button type="submit">{t('saveStatus', 'Save Status')}</Button>
                </div>
              </form>
            </Card>
          </div>
        ) : null}

        {showEmergencyModal && emergencyTargetStudent ? (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
            <Card className="w-[min(92vw,30rem)] max-w-none p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-2">{t('updateEmergencyContactTitle', 'Update Emergency Contact')}</h2>
              <p className="text-sm text-gray-600 mb-4">
                {emergencyTargetStudent.firstName} {emergencyTargetStudent.lastName}
              </p>

              <form onSubmit={handleEmergencySubmit} className="space-y-4">
                <Input
                  label={t('emergencyContactNameOptional', 'Emergency Contact Name (optional)')}
                  value={emergencyFormData.emergencyContactName}
                  onChange={(e) =>
                    setEmergencyFormData((prev) => ({ ...prev, emergencyContactName: e.target.value }))
                  }
                />

                <Input
                  label={t('emergencyContactPhone', 'Emergency Contact Phone')}
                  value={emergencyFormData.emergencyContactPhone}
                  onChange={(e) =>
                    setEmergencyFormData((prev) => ({ ...prev, emergencyContactPhone: e.target.value }))
                  }
                  required
                />

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowEmergencyModal(false)
                      setEmergencyTargetStudent(null)
                      resetEmergencyForm()
                    }}
                  >
                    {t('cancel', 'Cancel')}
                  </Button>
                  <Button type="submit">{t('saveEmergencyContact', 'Save Emergency Contact')}</Button>
                </div>
              </form>
            </Card>
          </div>
        ) : null}
      </div>

    </DashboardLayout>
  )
}
