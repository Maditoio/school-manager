'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'

interface Assessment {
  id: string
  title: string
  description: string | null
  type: string
  totalMarks: number
  dueDate: string | null
  published: boolean
  createdAt: string
  subject: {
    id: string
    name: string
  }
  gradedCount?: number
  _count?: {
    studentAssessments: number
  }
}

interface Class {
  id: string
  name: string
}

interface Subject {
  id: string
  name: string
}

interface Student {
  id: string
  firstName: string
  lastName: string
}

export default function TeacherAssessmentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState({
      classId: '',
      subjectId: '',
      studentId: '',
    })

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [publishLoadingId, setPublishLoadingId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'TEST',
    academicYear: new Date().getFullYear().toString(),
    term: 'Term 1',
    totalMarks: '',
    classId: '',
    subjectId: '',
    dueDate: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'TEACHER') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session) {
      fetchClasses()
      fetchSubjects('')
      fetchAssessments()
    }
  }, [session])

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes?teacherId=' + session?.user?.id)
      if (res.ok) {
        const data = await res.json()
        setClasses(Array.isArray(data.classes) ? data.classes : [])
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error)
    }
  }

  const fetchSubjects = async (classId?: string) => {
    try {
      const params = new URLSearchParams()
      if (classId) params.set('classId', classId)
      const res = await fetch(`/api/subjects${params.toString() ? `?${params.toString()}` : ''}`)
      if (res.ok) {
        const data = await res.json()
        setSubjects(Array.isArray(data.subjects) ? data.subjects : [])
      }
    } catch (error) {
      console.error('Failed to fetch subjects:', error)
    }
  }

  const fetchStudents = async (classId?: string) => {
    try {
      if (!classId) {
        setStudents([])
        return
      }

      const params = new URLSearchParams()
      params.set('classId', classId)
      const res = await fetch(`/api/students?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setStudents(Array.isArray(data.students) ? data.students : [])
      }
    } catch (error) {
      console.error('Failed to fetch students:', error)
    }
  }

  const fetchAssessments = async (activeFilters = filters) => {
    try {
      const params = new URLSearchParams()
      if (activeFilters.classId) params.set('classId', activeFilters.classId)
      if (activeFilters.subjectId) params.set('subjectId', activeFilters.subjectId)
      if (activeFilters.studentId) params.set('studentId', activeFilters.studentId)

      const res = await fetch(`/api/assessments${params.toString() ? `?${params.toString()}` : ''}`)
      if (res.ok) {
        const data = await res.json()
        setAssessments(Array.isArray(data.assessments) ? data.assessments : [])
      }
    } catch (error) {
      console.error('Failed to fetch assessments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setShowCreateForm(false)
        setFormData({
          title: '',
          description: '',
          type: 'TEST',
          academicYear: new Date().getFullYear().toString(),
          term: 'Term 1',
          totalMarks: '',
          classId: '',
          subjectId: '',
          dueDate: ''
        })
        await fetchAssessments()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to create assessment')
      }
    } catch (error) {
      console.error('Error creating assessment:', error)
      alert('Failed to create assessment')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assessment? This will also delete all student grades.')) {
      return
    }

    try {
      const res = await fetch(`/api/assessments/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await fetchAssessments()
      } else {
        alert('Failed to delete assessment')
      }
    } catch (error) {
      console.error('Error deleting assessment:', error)
      alert('Failed to delete assessment')
    }
  }

  const handleTogglePublish = async (assessment: Assessment) => {
    setPublishLoadingId(assessment.id)

    try {
      const res = await fetch(`/api/assessments/${assessment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: assessment.title,
          description: assessment.description,
          type: assessment.type,
          totalMarks: assessment.totalMarks,
          dueDate: assessment.dueDate,
          published: !assessment.published,
        }),
      })

      if (res.ok) {
        await fetchAssessments()
      } else {
        const error = await res.json().catch(() => ({}))
        alert(error.error || 'Failed to update publish status')
      }
    } catch (error) {
      console.error('Error updating publish status:', error)
      alert('Failed to update publish status')
    } finally {
      setPublishLoadingId(null)
    }
  }

  const applyFilters = async () => {
    setLoading(true)
    await fetchAssessments()
  }

  const clearFilters = async () => {
    const resetFilters = { classId: '', subjectId: '', studentId: '' }
    setFilters(resetFilters)
    setStudents([])
    await fetchSubjects('')
    setLoading(true)
    await fetchAssessments(resetFilters)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No due date'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = TEACHER_NAV_ITEMS

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Assessments</h1>
            <p className="text-gray-600 mt-2">Create and manage assessments for your classes</p>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? 'Cancel' : '+ Create Assessment'}
          </Button>
        </div>

        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
            <Card className="relative w-full max-w-3xl p-6">
              <button
                type="button"
                onClick={() => {
                  if (!formLoading) {
                    setShowCreateForm(false)
                  }
                }}
                disabled={formLoading}
                className="absolute right-4 top-4 ui-text-secondary hover:ui-text-primary disabled:opacity-50"
                aria-label="Close create assessment modal"
              >
                ✕
              </button>

              <h2 className="text-xl font-semibold mb-4">Create New Assessment</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Mid-Term Math Test"
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Assessment Type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                >
                  <option value="QUIZ">Quiz</option>
                  <option value="TEST">Test</option>
                  <option value="EXAM">Exam</option>
                  <option value="ASSIGNMENT">Assignment</option>
                </Select>

                <Input
                  label="Total Marks"
                  type="number"
                  value={formData.totalMarks}
                  onChange={(e) => setFormData({ ...formData, totalMarks: e.target.value })}
                  placeholder="e.g., 100"
                  min="0"
                  step="0.5"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Academic Year"
                  type="number"
                  value={formData.academicYear}
                  onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                  min="2000"
                  max="2100"
                  required
                />

                <Select
                  label="Term"
                  value={formData.term}
                  onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                  required
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </Select>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Class"
                  value={formData.classId}
                  onChange={(e) => {
                    const nextClassId = e.target.value
                    setFormData({ ...formData, classId: nextClassId, subjectId: '' })
                    fetchSubjects(nextClassId)
                  }}
                  required
                >
                  <option value="">Select a class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Subject"
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  required
                >
                  <option value="">Select a subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </Select>
              </div>

              <Input
                label="Due Date (Optional)"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />

              <Input
                label="Description (Optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add any additional details about this assessment"
              />

              <div className="flex gap-3">
                <Button type="submit" isLoading={formLoading}>
                  Create Assessment
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={formLoading}
                  className="bg-gray-500 hover:bg-gray-600"
                >
                  Cancel
                </Button>
              </div>
              </form>
            </Card>
          </div>
        )}

        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select
              label="Filter Class"
              value={filters.classId}
              onChange={(e) => {
                const nextClassId = e.target.value
                setFilters({ ...filters, classId: nextClassId, subjectId: '', studentId: '' })
                fetchSubjects(nextClassId)
                fetchStudents(nextClassId)
              }}
            >
              <option value="">All classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </Select>

            <Select
              label="Filter Subject"
              value={filters.subjectId}
              onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })}
            >
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </Select>

            <Select
              label="Filter Student"
              value={filters.studentId}
              onChange={(e) => setFilters({ ...filters, studentId: e.target.value })}
            >
              <option value="">All students</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.firstName} {student.lastName}
                </option>
              ))}
            </Select>

            <div className="flex items-end gap-2">
              <Button onClick={applyFilters}>Apply</Button>
              <Button onClick={clearFilters} className="bg-gray-500 hover:bg-gray-600">Clear</Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="px-6 py-12 text-center text-gray-500 text-sm">Loading assessments...</div>
          ) : assessments.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500 text-sm">
              No assessments yet. Click &quot;+ Create Assessment&quot; to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-medium">Title</th>
                    <th className="px-4 py-3 text-left font-medium">Subject</th>
                    <th className="px-4 py-3 text-center font-medium">Type</th>
                    <th className="px-4 py-3 text-center font-medium">Marks</th>
                    <th className="px-4 py-3 text-center font-medium">Due Date</th>
                    <th className="px-4 py-3 text-center font-medium">Students Graded</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assessments.map((assessment) => (
                    <tr key={assessment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{assessment.title}</div>
                        {assessment.description && (
                          <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate" title={assessment.description}>
                            {assessment.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{assessment.subject.name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {assessment.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-800">{assessment.totalMarks}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{formatDate(assessment.dueDate)}</td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {assessment.gradedCount ?? 0}/{assessment._count?.studentAssessments ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {assessment.published ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Published</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Draft</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/teacher/assessments/${assessment.id}/grade`)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                          >
                            Grade
                          </button>
                          <button
                            onClick={() => handleTogglePublish(assessment)}
                            disabled={publishLoadingId === assessment.id}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white rounded transition-colors disabled:opacity-60 ${
                              assessment.published
                                ? 'bg-amber-600 hover:bg-amber-700'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                          >
                            {publishLoadingId === assessment.id
                              ? 'Saving...'
                              : assessment.published
                                ? 'Unpublish'
                                : 'Publish'}
                          </button>
                          <button
                            onClick={() => handleDelete(assessment.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
