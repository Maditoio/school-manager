'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

interface Child {
  id: string
  firstName: string
  lastName: string
  class: {
    name: string
  }
}

interface Assessment {
  id: string
  score: number | null
  feedback: string | null
  graded: boolean
  submittedAt: string | null
  assessment: {
    id: string
    title: string
    description: string | null
    type: string
    totalMarks: number
    dueDate: string | null
    subject: {
      name: string
    }
  }
}

export default function ParentAssessmentsPage() {
  const { data: session, status } = useSession()
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState<string>('')
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [assessmentsLoading, setAssessmentsLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'PARENT') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session) {
      fetchChildren()
    }
  }, [session])

  useEffect(() => {
    if (selectedChild) {
      fetchAssessments(selectedChild)
    }
  }, [selectedChild])

  const fetchChildren = async () => {
    try {
      const res = await fetch('/api/students?parentId=' + session?.user?.id)
      if (res.ok) {
        const data = await res.json()
        const childrenData = Array.isArray(data.students) ? data.students : []
        setChildren(childrenData)
        if (childrenData.length > 0) {
          setSelectedChild(childrenData[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch children:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAssessments = async (studentId: string) => {
    setAssessmentsLoading(true)
    try {
      const res = await fetch(`/api/students/assessments?studentId=${studentId}`)
      if (res.ok) {
        const data = await res.json()
        setAssessments(Array.isArray(data.assessments) ? data.assessments : [])
      } else {
        setAssessments([])
      }
    } catch (error) {
      console.error('Failed to fetch assessments:', error)
      setAssessments([])
    } finally {
      setAssessmentsLoading(false)
    }
  }

  const calculatePercentage = (score: number, total: number) => {
    return ((score / total) * 100).toFixed(1)
  }

  const getGradeColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-blue-600'
    if (percentage >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
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
    { label: 'Dashboard', href: '/parent/dashboard', icon: '🏠' },
    { label: 'My Children', href: '/parent/children', icon: '👨‍👩‍👧‍👦' },
    { label: 'Attendance', href: '/parent/attendance', icon: '📅' },
    { label: 'Results', href: '/parent/results', icon: '📊' },
    { label: 'Assessments', href: '/parent/assessments', icon: '📋' },
    { label: 'Announcements', href: '/parent/announcements', icon: '📢' },
    { label: 'Messages', href: '/parent/messages', icon: '💬' },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Parent',
        role: 'Parent',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assessment Results</h1>
          <p className="text-gray-600 mt-2">View your child&apos;s assessment grades and feedback</p>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : children.length === 0 ? (
          <Card className="p-6">
            <p className="text-center text-gray-500">No children found</p>
          </Card>
        ) : (
          <>
            <Card className="p-6">
              <Select
                label="Select Child"
                value={selectedChild}
                onChange={(e) => setSelectedChild(e.target.value)}
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.firstName} {child.lastName} - {child.class.name}
                  </option>
                ))}
              </Select>
            </Card>

            {assessmentsLoading ? (
              <div>Loading assessments...</div>
            ) : assessments.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {assessments.map((studentAssessment) => {
                  const score = studentAssessment.score || 0
                  const total = studentAssessment.assessment.totalMarks
                  const percentage = parseFloat(calculatePercentage(score, total))

                  return (
                    <Card key={studentAssessment.id} className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-semibold text-gray-900">
                              {studentAssessment.assessment.title}
                            </h3>
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                              {studentAssessment.assessment.type}
                            </span>
                          </div>
                          <p className="text-gray-600 mt-2">
                            <span className="font-medium">Subject:</span> {studentAssessment.assessment.subject.name}
                          </p>
                          {studentAssessment.assessment.description && (
                            <p className="text-gray-600 mt-1">
                              {studentAssessment.assessment.description}
                            </p>
                          )}
                          <p className="text-gray-600 mt-1">
                            <span className="font-medium">Due Date:</span> {formatDate(studentAssessment.assessment.dueDate)}
                          </p>
                          {studentAssessment.submittedAt && (
                            <p className="text-gray-600 mt-1">
                              <span className="font-medium">Graded On:</span> {formatDate(studentAssessment.submittedAt)}
                            </p>
                          )}
                          {studentAssessment.feedback && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                              <p className="text-sm font-medium text-gray-700">Teacher Feedback:</p>
                              <p className="text-gray-900 mt-1">{studentAssessment.feedback}</p>
                            </div>
                          )}
                        </div>
                        <div className="ml-6 text-right">
                          <div className={`text-3xl font-bold ${getGradeColor(percentage)}`}>
                            {score}/{total}
                          </div>
                          <div className={`text-xl font-semibold ${getGradeColor(percentage)}`}>
                            {percentage}%
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card className="p-6">
                <p className="text-center text-gray-500">No graded assessments yet</p>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
