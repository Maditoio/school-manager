'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'

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

  const navItems = [
    { label: 'Dashboard', href: '/teacher/dashboard', icon: '📊' },
    { label: 'My Classes', href: '/teacher/classes', icon: '🏫' },
    { label: 'Students', href: '/teacher/students', icon: '👨‍🎓' },
    { label: 'Assessments', href: '/teacher/assessments', icon: '📋' },
    { label: 'Attendance', href: '/teacher/attendance', icon: '📅' },
    { label: 'Results', href: '/teacher/results', icon: '📝' },
    { label: 'Announcements', href: '/teacher/announcements', icon: '📢' },
    { label: 'Messages', href: '/teacher/messages', icon: '💬' },
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
          <Card className="p-6">
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
                  className="bg-gray-500 hover:bg-gray-600"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
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

        {loading ? (
          <div>Loading assessments...</div>
        ) : assessments.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {assessments.map((assessment) => (
              <Card key={assessment.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-gray-900">{assessment.title}</h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        {assessment.type}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <p className="text-gray-600">
                        <span className="font-medium">Subject:</span> {assessment.subject.name}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Total Marks:</span> {assessment.totalMarks}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Due Date:</span> {formatDate(assessment.dueDate)}
                      </p>
                      {assessment.description && (
                        <p className="text-gray-600">
                          <span className="font-medium">Description:</span> {assessment.description}
                        </p>
                      )}
                      <p className="text-gray-600">
                        <span className="font-medium">Students:</span> {assessment._count?.studentAssessments || 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => router.push(`/teacher/assessments/${assessment.id}/grade`)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Grade Students
                    </Button>
                    <Button
                      onClick={() => handleDelete(assessment.id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-gray-500">
              No assessments created yet. Click &quot;Create Assessment&quot; to get started.
            </p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
