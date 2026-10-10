'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'
import { useTeacherUi } from '@/lib/use-teacher-ui'

interface ClassItem {
  id: string
  name: string
}

interface SubjectItem {
  id: string
  name: string
  code?: string | null
}

interface AssessmentItem {
  id: string
  title: string
  type: string
}

interface AssessmentResult {
  id: string
  score: number | null
  graded: boolean
  feedback: string | null
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

export default function TeacherResultsPage() {
  const { data: session, status } = useSession()
  const { tTeacher, tCommon } = useTeacherUi()
  const t = (key: string, fallback: string) => tTeacher('results', key, fallback)

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [assessments, setAssessments] = useState<AssessmentItem[]>([])
  const [results, setResults] = useState<AssessmentResult[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedAssessment, setSelectedAssessment] = useState('')
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'TEACHER') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session?.user?.role === 'TEACHER') {
      fetchClasses()
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

  const fetchSubjectsForClass = async (classId: string) => {
    try {
      const res = await fetch(`/api/subjects?classId=${classId}`)
      if (res.ok) {
        const data = await res.json()
        setSubjects(Array.isArray(data.subjects) ? data.subjects : [])
      } else {
        setSubjects([])
      }
    } catch (error) {
      console.error('Failed to fetch subjects:', error)
      setSubjects([])
    }
  }

  const fetchAssessmentsForFilters = async (classId: string, subjectId: string) => {
    try {
      const params = new URLSearchParams()
      if (classId) params.set('classId', classId)
      if (subjectId) params.set('subjectId', subjectId)
      const res = await fetch(`/api/assessments?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setAssessments(Array.isArray(data.assessments) ? data.assessments : [])
      } else {
        setAssessments([])
      }
    } catch (error) {
      console.error('Failed to fetch assessments:', error)
      setAssessments([])
    }
  }

  const handleClassChange = async (classId: string) => {
    setSelectedClass(classId)
    setSelectedSubject('')
    setSelectedAssessment('')
    setSubjects([])
    setAssessments([])
    if (classId) {
      await fetchSubjectsForClass(classId)
    }
  }

  const handleSubjectChange = async (subjectId: string) => {
    setSelectedSubject(subjectId)
    setSelectedAssessment('')
    if (selectedClass && subjectId) {
      await fetchAssessmentsForFilters(selectedClass, subjectId)
    } else {
      setAssessments([])
    }
  }

  const fetchResults = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedClass) params.set('classId', selectedClass)
      if (selectedSubject) params.set('subjectId', selectedSubject)
      if (selectedAssessment) params.set('assessmentId', selectedAssessment)
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
  }, [selectedClass, selectedSubject, selectedAssessment])

  useEffect(() => {
    if (session?.user?.role === 'TEACHER') {
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

  const filterSummary = [
    selectedClass ? classes.find((c) => c.id === selectedClass)?.name : t('allClasses', 'All Classes'),
    selectedSubject ? subjects.find((s) => s.id === selectedSubject)?.name : null,
  ]
    .filter(Boolean)
    .join(' · ')

  if (status === 'loading' || !session) {
    return <div>{tCommon('loading', 'Loading...')}</div>
  }

  const filterFields = (
    <>
      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
          {t('classLabel', 'Class')}
        </label>
        <Select value={selectedClass} onChange={(event) => handleClassChange(event.target.value)}>
          <option value="">{t('allClasses', 'All Classes')}</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
          {t('subjectLabel', 'Subject')}
        </label>
        <Select
          value={selectedSubject}
          onChange={(event) => handleSubjectChange(event.target.value)}
          disabled={!selectedClass}
        >
          <option value="">{t('allSubjects', 'All Subjects')}</option>
          {subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code ? `${item.code} - ` : ''}
              {item.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
          {t('assessmentLabel', 'Assessment')}
        </label>
        <Select
          value={selectedAssessment}
          onChange={(event) => setSelectedAssessment(event.target.value)}
          disabled={!selectedSubject}
        >
          <option value="">{t('allAssessments', 'All Assessments')}</option>
          {assessments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} ({item.type})
            </option>
          ))}
        </Select>
      </div>
    </>
  )

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Teacher',
        role: 'Teacher',
        email: session.user.email,
      }}
      navItems={TEACHER_NAV_ITEMS}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-[20px] font-semibold ui-text-primary">{t('title', 'Assessment Results')}</h1>
          <p className="mt-1 text-sm ui-text-secondary">
            {t('subtitle', 'View all student results from assessments by class and subject')}
          </p>
        </div>

        <Card className="p-4">
          <button
            type="button"
            className="flex w-full min-h-11 items-center justify-between gap-3 rounded-[6px] border border-(--border-subtle) bg-(--surface-soft) px-3 text-left md:hidden"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.07em] ui-text-secondary">
                {tCommon('filter', 'Filter')}
              </p>
              <p className="truncate text-sm font-medium ui-text-primary">{filterSummary}</p>
            </div>
            <span className="shrink-0 text-sm font-medium" style={{ color: '#635bff' }}>
              {filtersOpen ? '↑' : '↓'}
            </span>
          </button>

          <div
            className={`${filtersOpen ? 'mt-3 grid' : 'hidden'} grid-cols-1 gap-3 md:mt-0 md:grid md:grid-cols-3`}
          >
            {filterFields}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-[0.07em] ui-text-secondary">
              {t('totalRecords', 'Total Records')}
            </p>
            <p className="text-xl font-semibold ui-text-primary">{summary.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-[0.07em] ui-text-secondary">{t('graded', 'Graded')}</p>
            <p className="text-xl font-semibold text-[#1b8a5a]">{summary.graded}</p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-[0.07em] ui-text-secondary">{t('pending', 'Pending')}</p>
            <p className="text-xl font-semibold text-[#b07d00]">{summary.pending}</p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-[0.07em] ui-text-secondary">
              {t('averagePct', 'Average (%)')}
            </p>
            <p className="text-xl font-semibold" style={{ color: '#635bff' }}>
              {summary.average}
            </p>
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="p-6">{t('loading', 'Loading assessment results...')}</div>
          ) : results.length > 0 ? (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 p-3 md:hidden">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="rounded-[10px] border border-(--border-subtle) bg-(--surface-card) p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold ui-text-primary">
                          {result.student.firstName} {result.student.lastName}
                        </p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-[0.07em] ui-text-secondary">
                          {result.student.admissionNumber || '—'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                          result.graded
                            ? 'bg-[#eafaf3] text-[#1b8a5a]'
                            : 'bg-[#fff8e6] text-[#b07d00]'
                        }`}
                      >
                        {result.graded ? t('gradedStatus', 'Graded') : t('notGraded', 'Not Graded')}
                      </span>
                    </div>
                    <p className="mt-3 text-sm ui-text-primary">{result.assessment.title}</p>
                    <p className="text-xs ui-text-secondary">
                      {result.assessment.class.name} · {result.assessment.subject.name}
                    </p>
                    <p className="mt-2 text-sm font-semibold ui-text-primary">
                      {result.score !== null
                        ? `${result.score} / ${result.assessment.totalMarks}`
                        : '—'}
                    </p>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto ui-table-wrap md:block">
                <table className="ui-table no-table-stripes min-w-full">
                  <thead>
                    <tr>
                      <th>{t('studentCol', 'Student')}</th>
                      <th>{t('classCol', 'Class')}</th>
                      <th>{t('subjectCol', 'Subject')}</th>
                      <th>{t('assessmentCol', 'Assessment')}</th>
                      <th>{t('scoreCol', 'Score')}</th>
                      <th>{t('statusCol', 'Status')}</th>
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
                          {result.score !== null
                            ? `${result.score} / ${result.assessment.totalMarks}`
                            : '-'}
                        </td>
                        <td>
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${
                              result.graded
                                ? 'bg-[#eafaf3] text-[#1b8a5a]'
                                : 'bg-[#fff8e6] text-[#b07d00]'
                            }`}
                          >
                            {result.graded ? t('gradedStatus', 'Graded') : t('notGraded', 'Not Graded')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-4 text-center ui-text-secondary">
              {t('noResultsFound', 'No assessment results found for the selected filters.')}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
