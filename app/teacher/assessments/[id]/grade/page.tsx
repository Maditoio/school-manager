'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import Table from '@/components/ui/Table'
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
  const [gradesSearch, setGradesSearch] = useState('')
  const [gradesPage, setGradesPage] = useState(1)
  const [savingGrade, setSavingGrade] = useState(false)
  
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

    if (savingGrade) {
      return
    }

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
      setSavingGrade(true)
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
    } finally {
      setSavingGrade(false)
    }
  }

  const calculatePercentage = (score: number | null, total: number) => {
    if (score === null) return '-'
    return ((score / total) * 100).toFixed(1) + '%'
  }

  const getGradeStatus = (graded: boolean) => {
    return graded ? (
      <span className="inline-flex items-center rounded-md border border-(--border-subtle) bg-(--surface-soft) px-2 py-1 text-xs ui-text-primary">Graded</span>
    ) : (
      <span className="inline-flex items-center rounded-md border border-(--border-subtle) bg-(--surface-soft) px-2 py-1 text-xs ui-text-secondary">Not Graded</span>
    )
  }

  const loadingIndicator = (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-2xl border border-(--border-subtle) bg-(--surface-soft) px-8 py-6 shadow-[0_12px_36px_rgba(2,6,23,0.14)]">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent)" />
          <p className="text-sm font-medium ui-text-primary">Loading assessment...</p>
        </div>
      </div>
    </div>
  )

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

  const pageSize = 10
  const assessmentTotalMarks = assessment?.totalMarks ?? 0

  const gradeRows = useMemo(
    () =>
      (assessment?.studentAssessments || []).map((studentAssessment) => ({
        id: studentAssessment.id,
        studentName: `${studentAssessment.student.firstName} ${studentAssessment.student.lastName}`,
        admissionNumber: studentAssessment.student.admissionNumber || '-',
        scoreDisplay:
          studentAssessment.score !== null
            ? `${studentAssessment.score} / ${assessmentTotalMarks}`
            : '-',
        percentage: calculatePercentage(studentAssessment.score, assessmentTotalMarks),
        graded: studentAssessment.graded,
        source: studentAssessment,
      })),
    [assessment?.studentAssessments, assessmentTotalMarks]
  )

  const filteredGradeRows = useMemo(() => {
    const query = gradesSearch.trim().toLowerCase()
    if (!query) return gradeRows

    return gradeRows.filter((row) => {
      return (
        row.studentName.toLowerCase().includes(query) ||
        row.admissionNumber.toLowerCase().includes(query)
      )
    })
  }, [gradeRows, gradesSearch])

  const pagedGradeRows = useMemo(() => {
    const start = (gradesPage - 1) * pageSize
    return filteredGradeRows.slice(start, start + pageSize)
  }, [filteredGradeRows, gradesPage])

  const gradeColumns = useMemo(
    () => [
      {
        key: 'studentName',
        label: 'Student',
        sortable: true,
      },
      {
        key: 'admissionNumber',
        label: 'Admission No.',
        sortable: true,
      },
      {
        key: 'scoreDisplay',
        label: 'Score',
      },
      {
        key: 'percentage',
        label: 'Percentage',
      },
      {
        key: 'status',
        label: 'Status',
        renderCell: (row: { graded: boolean }) => getGradeStatus(row.graded),
      },
      {
        key: 'gradeAction',
        label: 'Actions',
        renderCell: (row: { graded: boolean; source: StudentAssessment }) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openGradeModal(row.source)}
          >
            {row.graded ? 'Edit Grade' : 'Add Grade'}
          </Button>
        ),
      },
    ],
    [openGradeModal]
  )

  if (status === 'loading' || !session) {
    return loadingIndicator
  }

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
        {loadingIndicator}
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
            variant="secondary"
            className="mb-4"
          >
            ← Back to Assessments
          </Button>
          <h1 className="text-3xl font-bold ui-text-primary">{assessment.title}</h1>
          <p className="mt-2 ui-text-secondary">Grade students for this assessment</p>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm ui-text-secondary">Subject</p>
              <p className="text-lg font-semibold ui-text-primary">{assessment.subject.name}</p>
            </div>
            <div>
              <p className="text-sm ui-text-secondary">Type</p>
              <p className="text-lg font-semibold ui-text-primary">{assessment.type}</p>
            </div>
            <div>
              <p className="text-sm ui-text-secondary">Total Marks</p>
              <p className="text-lg font-semibold ui-text-primary">{assessment.totalMarks}</p>
            </div>
          </div>
          {assessment.description && (
            <div className="mt-4">
              <p className="text-sm ui-text-secondary">Description</p>
              <p className="ui-text-primary">{assessment.description}</p>
            </div>
          )}
          <div className="mt-4">
            <p className="text-sm ui-text-secondary">Progress</p>
            <p className="text-lg font-semibold ui-text-primary">
              {gradedCount} / {totalStudents} students graded
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <Table
            title="Student Grades"
            columns={gradeColumns}
            data={pagedGradeRows}
            totalCount={filteredGradeRows.length}
            page={gradesPage}
            pageSize={pageSize}
            onPageChange={setGradesPage}
            onSearch={(value: string) => {
              setGradesSearch(value)
              setGradesPage(1)
            }}
            rowKey="id"
            emptyMessage="No students available for grading."
          />
        </Card>

        {/* Grading Modal */}
        {gradingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
            <Card className="p-6 w-full max-w-md">
              <h2 className="mb-4 text-xl font-semibold ui-text-primary">Grade Student</h2>
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
                  <label className="mb-1 block text-sm font-medium ui-text-secondary">
                    Feedback (Optional)
                  </label>
                  <textarea
                    value={gradeForm.feedback}
                    onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                    placeholder="Add comments or feedback for the student"
                    className="ui-textarea"
                    rows={4}
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit" isLoading={savingGrade}>
                    Save Grade
                  </Button>
                  <Button
                    type="button"
                    onClick={closeGradeModal}
                    variant="secondary"
                    disabled={savingGrade}
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
