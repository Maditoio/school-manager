'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

interface ClassItem {
  id: string
  name: string
}

interface SubjectItem {
  id: string
  name: string
  code?: string | null
}

interface AssessmentResult {
  id: string
  score: number | null
  graded: boolean
  student: {
    id: string
    firstName: string
    lastName: string
    admissionNumber: string | null
  }
  assessment: {
    id: string
    title: string
    type: string
    totalMarks: number
    dueDate: string | null
    createdAt: string
    subject: {
      id: string
      name: string
      code: string | null
    }
    class: {
      id: string
      name: string
    }
  }
}

export default function AdminResultsPage() {
  const { data: session, status } = useSession()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [results, setResults] = useState<AssessmentResult[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session?.user?.role === 'SCHOOL_ADMIN') {
      fetchClasses()
      fetchSubjects()
    }
  }, [session])

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes')
      if (res.ok) {
        const data = await res.json()
        setClasses(Array.isArray(data.classes) ? data.classes : [])
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error)
    }
  }

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/subjects')
      if (res.ok) {
        const data = await res.json()
        setSubjects(Array.isArray(data.subjects) ? data.subjects : [])
      }
    } catch (error) {
      console.error('Failed to fetch subjects:', error)
    }
  }

  const fetchResults = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedClass) params.set('classId', selectedClass)
      if (selectedSubject) params.set('subjectId', selectedSubject)

      const res = await fetch(`/api/assessment-results?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setResults(Array.isArray(data.results) ? data.results : [])
      } else {
        setResults([])
      }
    } catch (error) {
      console.error('Failed to fetch assessment results:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [selectedClass, selectedSubject])

  useEffect(() => {
    if (session?.user?.role === 'SCHOOL_ADMIN') {
      fetchResults()
    }
  }, [session, fetchResults])

  const summary = useMemo(() => {
    const graded = results.filter((result) => result.graded && result.score !== null)
    const average = graded.length
      ? Math.round(
          graded.reduce(
            (total, result) => total + ((result.score || 0) / result.assessment.totalMarks) * 100,
            0
          ) / graded.length
        )
      : 0

    return {
      total: results.length,
      graded: graded.length,
      pending: results.length - graded.length,
      average,
    }
  }, [results])


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
        <div>
          <h1 className="text-[20px] font-semibold ui-text-primary">Assessment Results</h1>
          <p className="ui-text-secondary mt-1">View all student results from assessments by class and subject</p>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium ui-text-secondary mb-1">Class</label>
              <Select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
                <option value="">All Classes</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium ui-text-secondary mb-1">Subject</label>
              <Select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)}>
                <option value="">All Subjects</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code ? `${item.code} - ` : ''}{item.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs ui-text-secondary">Total Records</p>
            <p className="text-xl font-semibold ui-text-primary">{summary.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs ui-text-secondary">Graded</p>
            <p className="text-xl font-semibold text-green-700">{summary.graded}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs ui-text-secondary">Pending</p>
            <p className="text-xl font-semibold text-amber-700">{summary.pending}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs ui-text-secondary">Average (%)</p>
            <p className="text-xl font-semibold text-blue-700">{summary.average}</p>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-6">Loading assessment results...</div>
          ) : results.length > 0 ? (
            <div className="overflow-x-auto ui-table-wrap">
              <table className="ui-table min-w-full">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Assessment</th>
                    <th>Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.id}>
                      <td>
                        {result.student.admissionNumber ? `${result.student.admissionNumber} - ` : ''}
                        {result.student.firstName} {result.student.lastName}
                      </td>
                      <td>{result.assessment.class.name}</td>
                      <td>
                        {result.assessment.subject.code ? `${result.assessment.subject.code} - ` : ''}
                        {result.assessment.subject.name}
                      </td>
                      <td>
                        <div className="font-medium ui-text-primary">{result.assessment.title}</div>
                        <div className="text-xs ui-text-secondary">{result.assessment.type}</div>
                      </td>
                      <td>
                        {result.score !== null ? `${result.score} / ${result.assessment.totalMarks}` : '-'}
                      </td>
                      <td>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            result.graded
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {result.graded ? 'Graded' : 'Not Graded'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center ui-text-secondary">
              No assessment results found for the selected filters.
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
