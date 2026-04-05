'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

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
  const [resultsSearch, setResultsSearch] = useState('')
  const [resultsPage, setResultsPage] = useState(1)
  const [sortKey, setSortKey] = useState('student')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const pageSize = 10

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

  const filteredResults = useMemo(() => {
    const query = resultsSearch.trim().toLowerCase()
    if (!query) return results

    return results.filter((result) => {
      const studentName = `${result.student.firstName} ${result.student.lastName}`.toLowerCase()
      const subjectName = `${result.assessment.subject.code || ''} ${result.assessment.subject.name}`.toLowerCase()
      const assessmentTitle = result.assessment.title.toLowerCase()
      return studentName.includes(query) || subjectName.includes(query) || assessmentTitle.includes(query)
    })
  }, [results, resultsSearch])

  const sortedResults = useMemo(() => {
    const sorted = [...filteredResults]
    sorted.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1

      if (sortKey === 'student') {
        const nameA = `${a.student.firstName} ${a.student.lastName}`.toLowerCase()
        const nameB = `${b.student.firstName} ${b.student.lastName}`.toLowerCase()
        return nameA.localeCompare(nameB) * direction
      }

      if (sortKey === 'class') {
        return a.assessment.class.name.localeCompare(b.assessment.class.name) * direction
      }

      if (sortKey === 'subject') {
        return a.assessment.subject.name.localeCompare(b.assessment.subject.name) * direction
      }

      if (sortKey === 'score') {
        const scoreA = a.score ?? -1
        const scoreB = b.score ?? -1
        return (scoreA - scoreB) * direction
      }

      return Number(a.graded) === Number(b.graded) ? 0 : Number(a.graded) > Number(b.graded) ? direction : -direction
    })

    return sorted
  }, [filteredResults, sortDirection, sortKey])

  const paginatedResults = useMemo(() => {
    const start = (resultsPage - 1) * pageSize
    return sortedResults.slice(start, start + pageSize)
  }, [sortedResults, resultsPage])

  const resultColumns = useMemo(
    () => [
      {
        key: 'student',
        label: 'Student',
        sortable: true,
        renderCell: (result: AssessmentResult) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-100">
              {result.student.firstName} {result.student.lastName}
            </span>
            <span className="text-xs text-slate-400">{result.student.admissionNumber || 'No admission number'}</span>
          </div>
        ),
      },
      {
        key: 'class',
        label: 'Class',
        sortable: true,
        renderCell: (result: AssessmentResult) => result.assessment.class.name,
      },
      {
        key: 'subject',
        label: 'Subject',
        sortable: true,
        renderCell: (result: AssessmentResult) =>
          `${result.assessment.subject.code ? `${result.assessment.subject.code} - ` : ''}${result.assessment.subject.name}`,
      },
      {
        key: 'assessment',
        label: 'Assessment',
        renderCell: (result: AssessmentResult) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-100">{result.assessment.title}</span>
            <span className="text-xs text-slate-400">{result.assessment.type}</span>
          </div>
        ),
      },
      {
        key: 'score',
        label: 'Score',
        sortable: true,
        renderCell: (result: AssessmentResult) =>
          result.score !== null ? `${result.score} / ${result.assessment.totalMarks}` : '—',
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        renderCell: (result: AssessmentResult) => (result.graded ? 'Graded' : 'Not Graded'),
      },
    ],
    []
  )

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDirection('asc')
  }


  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = ADMIN_NAV_ITEMS

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

        <Table
          title="Assessment Results"
          columns={resultColumns}
          data={paginatedResults}
          loading={loading}
          totalCount={sortedResults.length}
          page={resultsPage}
          pageSize={pageSize}
          onSort={handleSort}
          onSearch={(value: string) => {
            setResultsSearch(value)
            setResultsPage(1)
          }}
          onPageChange={setResultsPage}
          headerControls={
            <select
              value={selectedSubject}
              onChange={(event) => {
                setSelectedSubject(event.target.value)
                setResultsPage(1)
              }}
              className="h-8 max-w-44 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[12px] text-slate-100 transition-all duration-200 ease-in-out outline-none focus:border-indigo-300/60 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
              aria-label="Filter by subject"
            >
              <option value="">All Subjects</option>
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code ? `${item.code} - ` : ''}{item.name}
                </option>
              ))}
            </select>
          }
          filterLabel="Class"
          filterOptions={[{ value: '', label: 'All Classes' }, ...classes.map((item) => ({ value: item.id, label: item.name }))]}
          activeFilter={selectedClass}
          onFilterChange={(value: string) => {
            setSelectedClass(value)
            setResultsPage(1)
          }}
          emptyMessage="No assessment results found for the selected filters."
          rowKey="id"
        />
      </div>
    </DashboardLayout>
  )
}
