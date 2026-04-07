'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

type Term = {
  id: string
  name: string
  academicYearId: string
  startDate: string
  endDate: string
  isCurrent: boolean
  isLocked: boolean
}

type AcademicYear = {
  id: string
  year: number
  name: string
  isCurrent: boolean
  terms: Term[]
}

export default function TermsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])

  const [yearInput, setYearInput] = useState(String(new Date().getFullYear()))
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('')
  const [termName, setTermName] = useState('Term 1')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN' && session?.user?.role !== 'DEPUTY_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  const fetchTerms = useCallback(async () => {
    try {
      const res = await fetch('/api/terms')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error || 'Failed to fetch terms')
      }

      const data = await res.json()
      const years = Array.isArray(data.academicYears) ? data.academicYears : []
      setAcademicYears(years)

      if (!selectedAcademicYearId && years.length > 0) {
        setSelectedAcademicYearId(years[0].id)
      }
    } catch (error) {
      console.error('Failed to fetch terms:', error)
      showToast(error instanceof Error ? error.message : 'Failed to fetch terms', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedAcademicYearId, showToast])

  useEffect(() => {
    if (session?.user?.role === 'SCHOOL_ADMIN' || session?.user?.role === 'DEPUTY_ADMIN') {
      fetchTerms()
    }
  }, [fetchTerms, session])

  const createAcademicYear = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const year = Number(yearInput)
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createAcademicYear',
          year,
          name: `Academic Year ${year}`,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create academic year')
      }

      showToast('Academic year saved', 'success')
      await fetchTerms()
      if (data?.academicYear?.id) {
        setSelectedAcademicYearId(data.academicYear.id)
      }
    } catch (error) {
      console.error('Failed to create academic year:', error)
      showToast(error instanceof Error ? error.message : 'Failed to create academic year', 'error')
    } finally {
      setSaving(false)
    }
  }

  const createTerm = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedAcademicYearId || !termName || !startDate || !endDate) {
      showToast('Academic year, name, start date and end date are required', 'error')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createTerm',
          academicYearId: selectedAcademicYearId,
          name: termName,
          startDate,
          endDate,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create term')
      }

      showToast('Term created', 'success')
      await fetchTerms()
    } catch (error) {
      console.error('Failed to create term:', error)
      showToast(error instanceof Error ? error.message : 'Failed to create term', 'error')
    } finally {
      setSaving(false)
    }
  }

  const setCurrentTerm = async (termId: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setCurrentTerm', termId }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to set current term')
      }
      showToast('Current term updated', 'success')
      await fetchTerms()
    } catch (error) {
      console.error('Failed to set current term:', error)
      showToast(error instanceof Error ? error.message : 'Failed to set current term', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleLock = async (term: Term) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/terms/${term.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: !term.isLocked }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update lock status')
      }
      showToast(term.isLocked ? 'Term unlocked' : 'Term locked', 'success')
      await fetchTerms()
    } catch (error) {
      console.error('Failed to update term lock:', error)
      showToast(error instanceof Error ? error.message : 'Failed to update term lock', 'error')
    } finally {
      setSaving(false)
    }
  }

  const allTerms = useMemo(
    () =>
      academicYears.flatMap((year) =>
        year.terms.map((term) => ({
          ...term,
          academicYearLabel: year.name,
          academicYear: year.year,
        }))
      ),
    [academicYears]
  )

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Academic Terms</h1>
          <p className="mt-2 text-gray-600">
            Create academic years, add terms, set one current term, and lock/unlock finalized terms.
          </p>
        </div>

        <Card title="Create Academic Year">
          <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={createAcademicYear}>
            <Input
              label="Year"
              type="number"
              min={2000}
              max={2100}
              value={yearInput}
              onChange={(event) => setYearInput(event.target.value)}
            />
            <Button type="submit" isLoading={saving}>Save Academic Year</Button>
          </form>
        </Card>

        <Card title="Create Term">
          <form className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5" onSubmit={createTerm}>
            <Select
              label="Academic Year"
              value={selectedAcademicYearId}
              onChange={(event) => setSelectedAcademicYearId(event.target.value)}
            >
              <option value="">Select year</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>

            <Input
              label="Term Name"
              value={termName}
              onChange={(event) => setTermName(event.target.value)}
              placeholder="Term 1"
            />

            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />

            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />

            <div className="flex items-end">
              <Button type="submit" isLoading={saving} className="w-full">Create Term</Button>
            </div>
          </form>
        </Card>

        <Card title="Terms">
          {loading ? (
            <p>Loading terms...</p>
          ) : allTerms.length === 0 ? (
            <p>No terms found. Create an academic year and terms to start.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-(--border-subtle)">
                    <th className="px-3 py-2 text-left">Academic Year</th>
                    <th className="px-3 py-2 text-left">Term</th>
                    <th className="px-3 py-2 text-left">Start</th>
                    <th className="px-3 py-2 text-left">End</th>
                    <th className="px-3 py-2 text-left">Current</th>
                    <th className="px-3 py-2 text-left">Locked</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allTerms.map((term) => (
                    <tr key={term.id} className="border-b border-(--border-subtle)">
                      <td className="px-3 py-2">{term.academicYearLabel}</td>
                      <td className="px-3 py-2">{term.name}</td>
                      <td className="px-3 py-2">{new Date(term.startDate).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{new Date(term.endDate).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{term.isCurrent ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">{term.isLocked ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={term.isCurrent || saving}
                            onClick={() => setCurrentTerm(term.id)}
                          >
                            Set Current
                          </Button>
                          <Button
                            size="sm"
                            variant={term.isLocked ? 'secondary' : 'danger'}
                            disabled={saving}
                            onClick={() => toggleLock(term)}
                          >
                            {term.isLocked ? 'Unlock' : 'Lock'}
                          </Button>
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
