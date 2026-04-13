'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, StatCard } from '@/components/ui/Card'
import { Select } from '@/components/ui/Form'
import Table from '@/components/ui/Table'
import { useCurrency } from '@/lib/currency-context'
import { useLocale } from '@/lib/locale-context'
import { translateText } from '@/lib/client-i18n'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'
import { Coins, Wallet, TrendingDown, CheckCircle2 } from 'lucide-react'

type SalaryRecord = {
  id: string
  amount: number
  paidAmount: number
  month: number
  year: number
  paymentDate: string | null
  status: 'PENDING' | 'PAID'
  notes: string | null
  createdAt: string
}

const MONTHS: Record<number, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
}

export default function TeacherSalaryPage() {
  const { data: session, status } = useSession()
  const { formatCurrency } = useCurrency()
  const { locale } = useLocale()
  const t = (text: string) => translateText(text, locale)
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<SalaryRecord[]>([])
  const [filterYear, setFilterYear] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'partial' | 'pending'>('all')
  const [page, setPage] = useState(1)
  const pageSize = 12

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && session.user.role !== 'TEACHER') redirect('/login')
  }, [session, status])

  useEffect(() => {
    if (session?.user?.role !== 'TEACHER') return

    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (filterYear) params.set('year', filterYear)
        const res = await fetch(`/api/teacher-salaries?${params.toString()}`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) {
          setRecords([])
          return
        }
        setRecords(Array.isArray(data.salaries) ? data.salaries : [])
      } catch {
        setRecords([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [session?.user?.role, filterYear])

  const availableYears = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.year))).sort((a, b) => b - a)
  }, [records])

  const filteredRows = useMemo(() => {
    return records.filter((r) => {
      const paid = r.paidAmount ?? 0
      const outstanding = Math.max(r.amount - paid, 0)
      if (filterStatus === 'paid') return outstanding <= 0
      if (filterStatus === 'partial') return paid > 0 && outstanding > 0
      if (filterStatus === 'pending') return paid <= 0
      return true
    })
  }, [records, filterStatus])

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page])

  const totals = useMemo(() => {
    const expected = filteredRows.reduce((sum, r) => sum + r.amount, 0)
    const paid = filteredRows.reduce((sum, r) => sum + (r.paidAmount ?? 0), 0)
    const outstanding = filteredRows.reduce((sum, r) => sum + Math.max(r.amount - (r.paidAmount ?? 0), 0), 0)
    const settledMonths = filteredRows.filter((r) => (r.paidAmount ?? 0) >= r.amount).length
    return { expected, paid, outstanding, settledMonths }
  }, [filteredRows])

  if (status === 'loading' || !session?.user) return <div>Loading...</div>

  const columns = [
    {
      key: 'period',
      label: t('Period'),
      renderCell: (r: SalaryRecord) => (
        <span className="font-medium ui-text-primary">{MONTHS[r.month] ?? `Month ${r.month}`} {r.year}</span>
      ),
    },
    {
      key: 'amount',
      label: t('Expected'),
      renderCell: (r: SalaryRecord) => formatCurrency(r.amount),
    },
    {
      key: 'paidAmount',
      label: t('Actual Paid'),
      renderCell: (r: SalaryRecord) => formatCurrency(r.paidAmount ?? 0),
    },
    {
      key: 'outstanding',
      label: t('Outstanding'),
      renderCell: (r: SalaryRecord) => formatCurrency(Math.max(r.amount - (r.paidAmount ?? 0), 0)),
    },
    {
      key: 'status',
      label: t('Status'),
      renderCell: (r: SalaryRecord) => {
        const paid = r.paidAmount ?? 0
        const outstanding = Math.max(r.amount - paid, 0)
        if (outstanding <= 0) return <span className="text-emerald-500 font-medium">{t('Paid')}</span>
        if (paid > 0) return <span className="text-blue-500 font-medium">{t('Partially Paid')}</span>
        return <span className="text-amber-500 font-medium">{t('Pending')}</span>
      },
    },
    {
      key: 'paymentDate',
      label: t('Payment Date'),
      renderCell: (r: SalaryRecord) => (r.paymentDate ? new Date(r.paymentDate).toLocaleDateString() : '—'),
    },
    {
      key: 'notes',
      label: t('Notes'),
      renderCell: (r: SalaryRecord) => (
        <span className="text-xs ui-text-secondary">{r.notes || '—'}</span>
      ),
    },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Teacher',
        role: 'Teacher',
        email: session.user.email,
      }}
      navItems={TEACHER_NAV_ITEMS}
    >
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold ui-text-primary">{t('My Salary')}</h1>
          <p className="mt-1 ui-text-secondary">{t('Track expected salary, payments received, and any remaining unpaid balances.')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title={t('Expected')} value={formatCurrency(totals.expected)} icon={<Coins className="h-4 w-4" />} />
          <StatCard title={t('Paid')} value={formatCurrency(totals.paid)} icon={<Wallet className="h-4 w-4" />} />
          <StatCard title={t('Outstanding')} value={formatCurrency(totals.outstanding)} icon={<TrendingDown className="h-4 w-4" />} />
          <StatCard title={t('Settled Months')} value={totals.settledMonths} icon={<CheckCircle2 className="h-4 w-4" />} />
        </div>

        <Card title={t('Filters')} className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select label={t('Year')} value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setPage(1) }}>
              <option value="">{t('All years')}</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
            <Select label={t('Status')} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value as 'all' | 'paid' | 'partial' | 'pending'); setPage(1) }}>
              <option value="all">{t('All')}</option>
              <option value="paid">{t('Paid')}</option>
              <option value="partial">{t('Partially Paid')}</option>
              <option value="pending">{t('Pending')}</option>
            </Select>
          </div>
        </Card>

        <Table
          title={t('Salary History')}
          columns={columns}
          data={paginatedRows}
          loading={loading}
          totalCount={filteredRows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          rowKey="id"
          emptyMessage={t('No salary records found.')}
        />
      </div>
    </DashboardLayout>
  )
}
