'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, StatCard } from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import { useCurrency } from '@/lib/currency-context'
import { translateText } from '@/lib/client-i18n'
import { useLocale } from '@/lib/locale-context'
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

export default function AdminLicensesPage() {
  const { data: session, status } = useSession()
  const { formatCurrency } = useCurrency()
  const { locale } = useLocale()
  const t = useCallback((text: string) => translateText(text, locale), [locale])
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
    if (session?.user?.role && !['SCHOOL_ADMIN', 'DEPUTY_ADMIN'].includes(session.user.role)) {
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
          throw new Error(data?.error || t('Failed to load license overview'))
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
        console.error('Failed to load admin licenses page:', error)
        setSummary(null)
        setStudents([])
        setLicenseDetails([])
      } finally {
        setLoading(false)
      }
    }

    loadOverview()
  }, [session?.user, t])

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

  if (status === 'loading' || !session) {
    return <div>{t('Loading...')}</div>
  }

  const navItems = session.user.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS

  const columns = [
    {
      key: 'studentName',
      label: t('Student'),
      renderCell: (row: StudentCoverage) => (
        <div className="flex flex-col">
          <span className="font-medium ui-text-primary">{row.studentName}</span>
          <span className="text-xs ui-text-secondary">{row.admissionNumber || t('No admission number')}</span>
        </div>
      ),
    },
    { key: 'className', label: t('Class') },
    {
      key: 'covered',
      label: t('Coverage'),
      renderCell: (row: StudentCoverage) => (
        <span className={row.covered ? 'text-emerald-500' : 'text-rose-500'}>
          {row.covered ? (row.coverageSource === 'BULK' ? t('Covered by bulk') : t('Covered by extra payment')) : t('Not covered')}
        </span>
      ),
    },
    {
      key: 'paidAmount',
      label: t('Paid Amount'),
      renderCell: (row: StudentCoverage) => formatCurrency(row.paidAmount),
    },
    {
      key: 'amountRequiredToCover',
      label: t('Amount Required'),
      renderCell: (row: StudentCoverage) =>
        row.amountRequiredToCover > 0 ? formatCurrency(row.amountRequiredToCover) : t('—'),
    },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session.user.role === 'DEPUTY_ADMIN' ? t('Deputy Admin') : t('School Admin'),
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-[24px] font-bold ui-text-primary">{t('School Licenses')}</h1>
          <p className="mt-1 ui-text-secondary">{t('Review school seat coverage and identify students that still need coverage.')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title={t('Active Students')} value={summary?.activeStudents ?? 0} icon={<Users className="h-4 w-4" />} />
          <StatCard title={t('Covered Students')} value={summary?.coveredStudents ?? 0} icon={<ShieldCheck className="h-4 w-4" />} />
          <StatCard title={t('Not Covered')} value={summary?.notCoveredStudents ?? 0} icon={<ShieldX className="h-4 w-4" />} />
          <StatCard title={t('Cost To Cover')} value={formatCurrency(summary?.costToCoverAllUncovered ?? 0)} icon={<AlertTriangle className="h-4 w-4" />} />
        </div>

        <Card title={t('Coverage Summary')}>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div><p className="ui-text-secondary">{t('License Year')}</p><p className="font-semibold ui-text-primary">{summary?.licenseYear ?? '-'}</p></div>
            <div><p className="ui-text-secondary">{t('Bulk Seats Purchased')}</p><p className="font-semibold ui-text-primary">{summary?.bulkSeatsPurchased ?? 0}</p></div>
            <div><p className="ui-text-secondary">{t('Covered by Bulk')}</p><p className="font-semibold ui-text-primary">{summary?.coveredByBulk ?? 0}</p></div>
            <div><p className="ui-text-secondary">{t('Covered by Extra Payments')}</p><p className="font-semibold ui-text-primary">{summary?.coveredByExtraPayments ?? 0}</p></div>
            <div><p className="ui-text-secondary">{t('Annual Price Per Student')}</p><p className="font-semibold ui-text-primary">{formatCurrency(summary?.annualPricePerStudent ?? 0)}</p></div>
            <div><p className="ui-text-secondary">{t('Students Not Covered')}</p><p className="font-semibold text-rose-500">{summary?.notCoveredStudents ?? 0}</p></div>
          </div>
        </Card>

        <Card title={t('License Details')}>
          <ul className="space-y-2 text-sm ui-text-secondary">
            {licenseDetails.map((item) => (
              <li key={item} className="rounded-[10px] border px-3 py-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}>
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <Table
          title={t('Student License Coverage')}
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
          filterLabel={t('Coverage')}
          filterOptions={[
            { value: 'all', label: t('All students') },
            { value: 'covered', label: t('Covered') },
            { value: 'not_covered', label: t('Not covered') },
          ]}
          activeFilter={coverageFilter}
          onFilterChange={(value) => {
            setCoverageFilter(value as 'all' | 'covered' | 'not_covered')
            setCurrentPage(1)
          }}
          rowKey="studentId"
          emptyMessage={t('No student license records available for the current school.')}
        />
      </div>
    </DashboardLayout>
  )
}
