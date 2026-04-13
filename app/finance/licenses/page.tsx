'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, StatCard } from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import { FINANCE_MANAGER_NAV_ITEMS, FINANCE_NAV_ITEMS } from '@/lib/admin-nav'
import { useCurrency } from '@/lib/currency-context'
import { AlertTriangle, ShieldCheck, ShieldX, Users } from 'lucide-react'

type LicenseSummary = {
  licenseYear: number
  activeStudents: number
  coveredStudents: number
  notCoveredStudents: number
  bulkSeatsPurchased: number
  coveredByBulk: number
  coveredByExtraPayments: number
  annualPricePerStudent: number
  costToCoverAllUncovered: number
}

type StudentCoverage = {
  studentId: string
  studentName: string
  admissionNumber: string | null
  className: string
  covered: boolean
  coverageSource: 'BULK' | 'EXTRA_PAYMENT' | null
  paidAmount: number
  amountRequiredToCover: number
}

export default function FinanceLicensesPage() {
  const { data: session, status } = useSession()
  const { formatCurrency } = useCurrency()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<LicenseSummary | null>(null)
  const [students, setStudents] = useState<StudentCoverage[]>([])
  const [licenseDetails, setLicenseDetails] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [coverageFilter, setCoverageFilter] = useState<'all' | 'covered' | 'not_covered'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 15

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role && !['FINANCE', 'FINANCE_MANAGER'].includes(session.user.role)) {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (!session?.user) return

    const loadOverview = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/licenses/overview', { credentials: 'include', cache: 'no-store' })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load license overview')
        }

        setSummary(data.summary)
        setStudents(Array.isArray(data.students) ? data.students : [])
        setLicenseDetails(
          Array.isArray(data.licenseDetails)
            ? data.licenseDetails
            : Array.isArray(data.consequences)
              ? data.consequences
              : [],
        )
      } catch (error) {
        console.error('Failed to load finance licenses page:', error)
        setSummary(null)
        setStudents([])
        setLicenseDetails([])
      } finally {
        setLoading(false)
      }
    }

    loadOverview()
  }, [session?.user])

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = session.user.role === 'FINANCE_MANAGER' ? FINANCE_MANAGER_NAV_ITEMS : FINANCE_NAV_ITEMS

  const filteredRows = useMemo(() => {
    let rows = students

    if (coverageFilter === 'covered') rows = rows.filter((r) => r.covered)
    else if (coverageFilter === 'not_covered') rows = rows.filter((r) => !r.covered)

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      rows = rows.filter(
        (row) =>
          row.studentName.toLowerCase().includes(query) ||
          row.className.toLowerCase().includes(query) ||
          String(row.admissionNumber || '').toLowerCase().includes(query),
      )
    }

    return rows
  }, [students, searchQuery, coverageFilter])

  const columns = [
    {
      key: 'studentName',
      label: 'Student',
      renderCell: (row: StudentCoverage) => (
        <div className="flex flex-col">
          <span className="font-medium ui-text-primary">{row.studentName}</span>
          <span className="text-xs ui-text-secondary">{row.admissionNumber || 'No admission number'}</span>
        </div>
      ),
    },
    { key: 'className', label: 'Class' },
    {
      key: 'covered',
      label: 'Coverage',
      renderCell: (row: StudentCoverage) => (
        <span className={row.covered ? 'text-emerald-500' : 'text-rose-500'}>
          {row.covered ? (row.coverageSource === 'BULK' ? 'Covered by bulk' : 'Covered by extra payment') : 'Not covered'}
        </span>
      ),
    },
    {
      key: 'paidAmount',
      label: 'Paid Amount',
      renderCell: (row: StudentCoverage) => formatCurrency(row.paidAmount),
    },
    {
      key: 'amountRequiredToCover',
      label: 'Amount Required',
      renderCell: (row: StudentCoverage) =>
        row.amountRequiredToCover > 0 ? formatCurrency(row.amountRequiredToCover) : '—',
    },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Finance',
        role: session.user.role === 'FINANCE_MANAGER' ? 'Finance Manager' : 'Finance',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-[24px] font-bold ui-text-primary">Licenses Overview</h1>
          <p className="mt-1 ui-text-secondary">Track license coverage, student consequences, and the amount needed to cover all uncovered students.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Active Students" value={summary?.activeStudents ?? 0} icon={<Users className="h-4 w-4" />} />
          <StatCard title="Covered Students" value={summary?.coveredStudents ?? 0} icon={<ShieldCheck className="h-4 w-4" />} />
          <StatCard title="Not Covered" value={summary?.notCoveredStudents ?? 0} icon={<ShieldX className="h-4 w-4" />} />
          <StatCard title="Cost To Cover" value={formatCurrency(summary?.costToCoverAllUncovered ?? 0)} icon={<AlertTriangle className="h-4 w-4" />} />
        </div>

        <Card title="Coverage Summary">
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div><p className="ui-text-secondary">License Year</p><p className="font-semibold ui-text-primary">{summary?.licenseYear ?? '-'}</p></div>
            <div><p className="ui-text-secondary">Bulk Seats Purchased</p><p className="font-semibold ui-text-primary">{summary?.bulkSeatsPurchased ?? 0}</p></div>
            <div><p className="ui-text-secondary">Covered by Bulk</p><p className="font-semibold ui-text-primary">{summary?.coveredByBulk ?? 0}</p></div>
            <div><p className="ui-text-secondary">Covered by Extra Payments</p><p className="font-semibold ui-text-primary">{summary?.coveredByExtraPayments ?? 0}</p></div>
            <div><p className="ui-text-secondary">Annual Price Per Student</p><p className="font-semibold ui-text-primary">{formatCurrency(summary?.annualPricePerStudent ?? 0)}</p></div>
            <div><p className="ui-text-secondary">Students Not Covered</p><p className="font-semibold text-rose-500">{summary?.notCoveredStudents ?? 0}</p></div>
          </div>
        </Card>

        <Card title="License Details">
          <ul className="space-y-2 text-sm ui-text-secondary">
            {licenseDetails.map((item) => (
              <li key={item} className="rounded-[10px] border px-3 py-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}>
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <Table
          title="Student License Coverage"
          columns={columns}
          data={filteredRows}
          loading={loading}
          page={currentPage}
          pageSize={pageSize}
          totalCount={filteredRows.length}
          onPageChange={setCurrentPage}
          onSearch={(value: string) => {
            setSearchQuery(value)
            setCurrentPage(1)
          }}
          filterLabel="Coverage"
          filterOptions={[
            { value: 'all', label: 'All students' },
            { value: 'covered', label: 'Covered' },
            { value: 'not_covered', label: 'Not covered' },
          ]}
          activeFilter={coverageFilter}
          onFilterChange={(value) => {
            setCoverageFilter(value as 'all' | 'covered' | 'not_covered')
            setCurrentPage(1)
          }}
          rowKey="studentId"
          emptyMessage="No student license records available for the current school."
        />
      </div>
    </DashboardLayout>
  )
}