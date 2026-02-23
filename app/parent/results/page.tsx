'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

interface Student {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string
}

interface Result {
  id: string
  score: number | null
  graded: boolean
  feedback: string | null
  submittedAt: string | null
  assessment: {
    id: string
    title: string
    type: string
    totalMarks: number
    dueDate: string | null
    subject: { name: string; code: string | null }
  }
}

export default function ParentResultsPage() {
  const { data: session, status } = useSession()
  const [children, setChildren] = useState<Student[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [selectedChild, setSelectedChild] = useState('')
  const [loading, setLoading] = useState(true)
  const [resultsLoading, setResultsLoading] = useState(false)

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
      const fetchChildrenData = async () => {
        try {
          const res = await fetch('/api/students?parentId=' + session?.user?.id)
          if (res.ok) {
            const data = await res.json()
            const childrenArray = Array.isArray(data.students) ? data.students : []
            setChildren(childrenArray)
            if (childrenArray.length > 0) {
              setSelectedChild(childrenArray[0].id)
            }
          } else {
            setChildren([])
          }
        } catch (error) {
          console.error('Failed to fetch children:', error)
          setChildren([])
        } finally {
          setLoading(false)
        }
      }
      fetchChildrenData()
    }
  }, [session])

  useEffect(() => {
    if (selectedChild) {
      setResultsLoading(true)
      const fetchResultsData = async () => {
        try {
          const res = await fetch(`/api/students/assessments?studentId=${selectedChild}`)
          if (res.ok) {
            const data = await res.json()
            setResults(Array.isArray(data.assessments) ? data.assessments : [])
          } else {
            setResults([])
          }
        } catch (error) {
          console.error('Failed to fetch results:', error)
          setResults([])
        } finally {
          setResultsLoading(false)
        }
      }
      fetchResultsData()
    }
  }, [selectedChild])

  const calculatePercentage = (score: number | null, maxScore: number) => {
    if (score === null) return '-'
    return ((score / maxScore) * 100).toFixed(1)
  }

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' }
    if (percentage >= 80) return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' }
    if (percentage >= 70) return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' }
    if (percentage >= 60) return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' }
    return { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' }
  }

  const getGrade = (percentage: number) => {
    if (percentage >= 90) return 'A'
    if (percentage >= 80) return 'B'
    if (percentage >= 70) return 'C'
    if (percentage >= 60) return 'D'
    return 'F'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
      <div className="min-h-screen bg-linear-to-b from-emerald-50 via-white to-blue-50">
        <div className="mx-auto w-full max-w-md space-y-5 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] px-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Assessment Results
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">All Assessment Results</h1>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-semibold text-slate-900 mb-3">Select Child</label>
            <Select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select Child</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.firstName} {child.lastName} ({child.admissionNumber})
                </option>
              ))}
            </Select>
          </section>

          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl bg-linear-to-r from-slate-100 to-slate-200 h-24 animate-pulse"></div>
                ))}
              </div>
            </section>
          ) : resultsLoading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl bg-linear-to-r from-slate-100 to-slate-200 h-24 animate-pulse"></div>
                ))}
              </div>
            </section>
          ) : selectedChild && results.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Results
                </h2>
                <span className="rounded-full bg-linear-to-r from-slate-100 to-slate-50 px-3 py-1 text-xs text-slate-500 border border-slate-200">
                  {results.length} assessments
                </span>
              </div>
              <div className="space-y-3">
                {results.map((result) => {
                  const percentageText = calculatePercentage(result.score, result.assessment.totalMarks)
                  const percentage = percentageText === '-' ? null : parseFloat(percentageText)
                  const grade = percentage === null ? '-' : getGrade(percentage)
                  const gradeColor = percentage === null
                    ? { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' }
                    : getGradeColor(percentage)
                  return (
                    <article
                      key={result.id}
                      className="rounded-2xl border border-slate-200 bg-linear-to-br from-white to-slate-50 p-4 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-500 uppercase">
                            {result.assessment.subject?.code || result.assessment.type}
                          </p>
                          <h3 className="text-sm font-semibold text-slate-900 mt-1">
                            {result.assessment.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">{result.assessment.subject?.name}</p>
                        </div>
                        <div className={`shrink-0 rounded-lg px-3 py-2 text-center border ${gradeColor.bg} ${gradeColor.text} ${gradeColor.border}`}>
                          <p className="text-xl font-bold">{grade}</p>
                          <p className="text-xs">{percentageText === '-' ? 'Pending' : `${percentageText}%`}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-slate-600">
                          Score: <span className="font-semibold text-slate-900">{result.score === null ? '-' : `${result.score}/${result.assessment.totalMarks}`}</span>
                        </p>
                        <p className="text-xs text-slate-400">📅 {formatDate(result.submittedAt || result.assessment.dueDate || new Date().toISOString())}</p>
                      </div>
                      {result.feedback ? (
                        <p className="mt-2 text-xs text-slate-700">Feedback: {result.feedback}</p>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </section>
          ) : selectedChild ? (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-linear-to-br from-slate-50 to-slate-100 p-6 text-center">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-sm text-slate-600">No assessment results yet</p>
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-linear-to-br from-slate-50 to-slate-100 p-6 text-center">
              <div className="text-4xl mb-2">👋</div>
              <p className="text-sm text-slate-600">Please select a child to view results</p>
            </section>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
