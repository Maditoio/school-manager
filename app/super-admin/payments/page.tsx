'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Select, Input } from '@/components/ui/Form'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'
import { useLocale } from '@/lib/locale-context'

interface SchoolOption {
  id: string
  name: string
}

interface PaymentRow {
  id: string
  amount: number
  paymentType: 'ONBOARDING' | 'ANNUAL' | 'ADJUSTMENT'
  paymentDate: string
  paymentMethod: string | null
  referenceNumber: string | null
  notes: string | null
  billing: {
    schoolId: string
    onboardingStatus: 'PENDING' | 'PAID' | 'WAIVED'
    annualPricePerStudent: number
    licensedStudentCount: number
    billingYear: number
    school: {
      id: string
      name: string
    }
  }
  recordedBy: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  } | null
}

function usd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export default function SuperAdminPaymentsPage() {
  const { data: session, status } = useSession()
  const { locale } = useLocale()

  const [loading, setLoading] = useState(true)
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [summary, setSummary] = useState({ count: 0, totalAmount: 0 })

  const [schoolId, setSchoolId] = useState('')
  const [paymentType, setPaymentType] = useState('')
  const [onboardingStatus, setOnboardingStatus] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') redirect('/login')
  }, [session, status])

  async function fetchSchools() {
    const res = await fetch('/api/schools')
    if (!res.ok) return
    const data = await res.json()
    setSchools((Array.isArray(data.schools) ? data.schools : []).map((s: any) => ({ id: s.id, name: s.name })))
  }

  async function fetchPayments() {
    const params = new URLSearchParams()
    if (schoolId) params.set('schoolId', schoolId)
    if (paymentType) params.set('paymentType', paymentType)
    if (onboardingStatus) params.set('onboardingStatus', onboardingStatus)
    if (fromDate) params.set('fromDate', fromDate)
    if (toDate) params.set('toDate', toDate)

    const res = await fetch(`/api/schools/billing-payments?${params.toString()}`)
    if (!res.ok) {
      setPayments([])
      setSummary({ count: 0, totalAmount: 0 })
      return
    }

    const data = await res.json()
    setPayments(Array.isArray(data.payments) ? data.payments : [])
    setSummary({
      count: Number(data.summary?.count) || 0,
      totalAmount: Number(data.summary?.totalAmount) || 0,
    })
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchSchools(), fetchPayments()])
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated' && session?.user?.role === 'SUPER_ADMIN') {
      load()
    }
  }, [status, session?.user?.role])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'SUPER_ADMIN') {
      fetchPayments()
    }
  }, [schoolId, paymentType, onboardingStatus, fromDate, toDate])

  const preferredLanguage = String(locale || session?.user?.preferredLanguage || 'en').toLowerCase()
  const t = useMemo(() => {
    const messages = preferredLanguage.startsWith('fr')
      ? frMessages
      : preferredLanguage.startsWith('sw')
        ? swMessages
        : enMessages
    return (key: string) => {
      const keys = key.split('.')
      let value: any = messages
      for (const k of keys) value = value?.[k]
      return value || key
    }
  }, [preferredLanguage])

  if (status === 'loading' || !session) return <div>{t('common.loading')}</div>

  const navItems = [
    { label: t('navigation.dashboard'), href: '/super-admin/dashboard', icon: '📊' },
    { label: t('navigation.schools'), href: '/super-admin/schools', icon: '🏢' },
    { label: t('navigation.users'), href: '/super-admin/users', icon: '👥' },
    { label: t('navigation.analytics'), href: '/super-admin/analytics', icon: '📈' },
    { label: 'Payments', href: '/super-admin/payments', icon: '💳' },
    { label: 'Settings', href: '/super-admin/settings', icon: '⚙️' },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || t('roles.super_admin'),
        role: t('roles.super_admin'),
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">School Payments</h1>
          <p className="text-gray-600 mt-2">Filter and review billing payments across all schools.</p>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Select label="School" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              <option value="">All schools</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </Select>

            <Select label="Payment type" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
              <option value="">All types</option>
              <option value="ONBOARDING">Onboarding</option>
              <option value="ANNUAL">Annual</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </Select>

            <Select label="Onboarding status" value={onboardingStatus} onChange={(e) => setOnboardingStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="WAIVED">Waived</option>
            </Select>

            <Input label="From date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input label="To date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Payment records</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.count}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total amount (USD)</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{usd(summary.totalAmount)}</p>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading payments...</div>
          ) : payments.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">No payments found for selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">School</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Amount (USD)</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Recorded by</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b last:border-b-0 hover:bg-gray-50/60">
                      <td className="px-4 py-3 text-sm text-gray-700">{new Date(payment.paymentDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{payment.billing.school.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          payment.paymentType === 'ONBOARDING'
                            ? 'bg-blue-100 text-blue-700'
                            : payment.paymentType === 'ANNUAL'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-purple-100 text-purple-700'
                        }`}>
                          {payment.paymentType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-semibold">{usd(payment.amount)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{payment.billing.onboardingStatus}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {payment.recordedBy
                          ? `${payment.recordedBy.firstName || ''} ${payment.recordedBy.lastName || ''}`.trim() || payment.recordedBy.email
                          : 'System'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{payment.referenceNumber || '-'}</td>
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
