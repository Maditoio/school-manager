'use client'

import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect, useParams, useRouter } from 'next/navigation'

interface Student {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string | null
}

interface StudentAssessment {
  id: string
  score: number | null
  feedback: string | null
  graded: boolean
  student: Student
}

interface Assessment {
  id: string
  title: string
  description: string | null
  type: string
  totalMarks: number
  dueDate: string | null
  subject: {
    id: string
    name: string
  }
  studentAssessments: StudentAssessment[]
}

export default function GradeAssessmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const assessmentId = params?.id
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [gradingStudent, setGradingStudent] = useState<string | null>(null)
  
  // Grading form state
  const [gradeForm, setGradeForm] = useState<{
    studentAssessmentId: string
    score: string
    feedback: string
  }>({
    studentAssessmentId: '',
    score: '',
    feedback: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'TEACHER') {
      redirect('/login')
    }
  }, [session, status])

  const fetchAssessment = useCallback(async () => {
    if (!assessmentId) {
      alert('Invalid assessment ID')
      router.push('/teacher/assessments')
      return
    }

    try {
      const res = await fetch(`/api/assessments/${assessmentId}`)
      if (res.ok) {
        const data = await res.json()
        setAssessment(data.assessment)
      } else {
        alert('Failed to load assessment')
        router.push('/teacher/assessments')
      }
    } catch (error) {
      console.error('Failed to fetch assessment:', error)
      alert('Failed to load assessment')
      router.push('/teacher/assessments')
    } finally {
      setLoading(false)
    }
  }, [assessmentId, router])

  useEffect(() => {
    if (session && assessmentId) {
      fetchAssessment()
    }
  }, [session, assessmentId, fetchAssessment])

  const openGradeModal = (studentAssessment: StudentAssessment) => {
    setGradeForm({
      studentAssessmentId: studentAssessment.id,
      score: studentAssessment.score?.toString() || '',
      feedback: studentAssessment.feedback || ''
    })
    setGradingStudent(studentAssessment.student.id)
  }

  const closeGradeModal = () => {
    setGradingStudent(null)
    setGradeForm({
      studentAssessmentId: '',
      score: '',
      feedback: ''
    })
  }

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!gradeForm.score) {
      alert('Please enter a score')
      return
    }

    const score = parseFloat(gradeForm.score)
    if (isNaN(score) || score < 0 || score > (assessment?.totalMarks || 0)) {
      alert(`Score must be between 0 and ${assessment?.totalMarks}`)
      return
    }

    try {
      const res = await fetch(`/api/assessments/grade/${gradeForm.studentAssessmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: gradeForm.score,
          feedback: gradeForm.feedback
        })
      })

      if (res.ok) {
        closeGradeModal()
        fetchAssessment()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to save grade')
      }
    } catch (error) {
      console.error('Error saving grade:', error)
      alert('Failed to save grade')
    }
  }

  const calculatePercentage = (score: number | null, total: number) => {
    if (score === null) return '-'
    return ((score / total) * 100).toFixed(1) + '%'
  }

  const getGradeStatus = (graded: boolean) => {
    return graded ? (
      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Graded</span>
    ) : (
      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Not Graded</span>
    )
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

  if (loading) {
    return (
      <DashboardLayout
        user={{
          name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Teacher',
          role: 'Teacher',
          email: session.user.email,
        }}
        navItems={navItems}
      >
        <div>Loading assessment...</div>
      </DashboardLayout>
    )
  }

  if (!assessment) {
    return (
      <DashboardLayout
        user={{
          name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Teacher',
          role: 'Teacher',
          email: session.user.email,
        }}
        navItems={navItems}
      >
        <div>Assessment not found</div>
      </DashboardLayout>
    )
  }

  const gradedCount = assessment.studentAssessments.filter(sa => sa.graded).length
  const totalStudents = assessment.studentAssessments.length

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
        <div>
          <Button
            onClick={() => router.push('/teacher/assessments')}
            className="mb-4 bg-gray-500 hover:bg-gray-600"
          >
            ← Back to Assessments
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">{assessment.title}</h1>
          <p className="text-gray-700 mt-2">Grade students for this assessment</p>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-800">Subject</p>
              <p className="text-lg font-semibold">{assessment.subject.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-800">Type</p>
              <p className="text-lg font-semibold">{assessment.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-800">Total Marks</p>
              <p className="text-lg font-semibold">{assessment.totalMarks}</p>
            </div>
          </div>
          {assessment.description && (
            <div className="mt-4">
              <p className="text-sm text-gray-800">Description</p>
              <p className="text-gray-900">{assessment.description}</p>
            </div>
          )}
          <div className="mt-4">
            <p className="text-sm text-gray-800">Progress</p>
            <p className="text-lg font-semibold">
              {gradedCount} / {totalStudents} students graded
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Student Grades</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Admission No.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Percentage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assessment.studentAssessments.map((studentAssessment) => (
                  <tr key={studentAssessment.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {studentAssessment.student.firstName} {studentAssessment.student.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {studentAssessment.student.admissionNumber || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {studentAssessment.score !== null
                          ? `${studentAssessment.score} / ${assessment.totalMarks}`
                          : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {calculatePercentage(studentAssessment.score, assessment.totalMarks)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getGradeStatus(studentAssessment.graded)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Button
                        onClick={() => openGradeModal(studentAssessment)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {studentAssessment.graded ? 'Edit Grade' : 'Add Grade'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Grading Modal */}
        {gradingStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Grade Student</h2>
              <form onSubmit={handleGradeSubmit} className="space-y-4">
                <Input
                  label={`Score (out of ${assessment.totalMarks})`}
                  type="number"
                  value={gradeForm.score}
                  onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })}
                  placeholder="Enter score"
                  min="0"
                  max={assessment.totalMarks}
                  step="0.5"
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Feedback (Optional)
                  </label>
                  <textarea
                    value={gradeForm.feedback}
                    onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                    placeholder="Add comments or feedback for the student"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 bg-white"
                    rows={4}
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit">
                    Save Grade
                  </Button>
                  <Button
                    type="button"
                    onClick={closeGradeModal}
                    className="bg-gray-500 hover:bg-gray-600"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
