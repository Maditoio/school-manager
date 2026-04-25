'use client'

import { useEffect, useMemo, useState, use } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'
import { useLocale } from '@/lib/locale-context'

interface SchoolDetail {
  id: string
  name: string
  plan: string
  active: boolean
  suspended: boolean
  suspensionReason: string | null
  createdAt: string
  schoolSettings?: {
    slogan: string | null
    allowCrossSchoolCourses: boolean
    videoCoursesEnabled: boolean
  } | null
  schoolBilling?: {
    id: string
    onboardingFee: number
    onboardingStatus: 'PENDING' | 'PAID' | 'WAIVED'
    annualPricePerStudent: number
    licensedStudentCount: number
    billingYear: number
    licenseStartDate: string | null
    licenseEndDate: string | null
    enabledModules: string[]
    notes: string | null
  } | null
  _count: {
    users: number
    students: number
    classes: number
    subjects: number
  }
}

interface LedgerPayment {
  id: string
  amount: number
  paymentType: 'ONBOARDING' | 'ANNUAL' | 'ADJUSTMENT'
  paymentDate: string
  paymentMethod: string | null
  referenceNumber: string | null
  notes: string | null
  recordedBy: { id: string; firstName: string | null; lastName: string | null; email: string } | null
}

function usd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function daysUntil(dateValue: string | null | undefined) {
  if (!dateValue) return null
  const end = new Date(dateValue)
  if (Number.isNaN(end.getTime())) return null
  const today = new Date()
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

export default function SuperAdminSchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { locale } = useLocale()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [savingPayment, setSavingPayment] = useState(false)
  const [school, setSchool] = useState<SchoolDetail | null>(null)
  const [payments, setPayments] = useState<LedgerPayment[]>([])
  const [totalPaid, setTotalPaid] = useState(0)

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentType: 'ANNUAL',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: '',
    referenceNumber: '',
    notes: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') redirect('/login')
  }, [session, status])

  async function fetchSchool() {
    const res = await fetch(`/api/schools/${id}`)
    if (!res.ok) return
    const data = await res.json()
    setSchool(data.school ?? null)
  }

  async function fetchPayments() {
    const res = await fetch(`/api/schools/${id}/billing-payments`)
    if (!res.ok) {
      setPayments([])
      setTotalPaid(0)
      return
    }
    const data = await res.json()
    setPayments(Array.isArray(data.payments) ? data.payments : [])
    setTotalPaid(Number(data.totalPaid) || 0)
  }

  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([fetchSchool(), fetchPayments()])
      } catch (error) {
        console.error('Failed to load school details:', error)
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated' && session?.user?.role === 'SUPER_ADMIN') {
      load()
    }
  }, [id, session?.user?.role, status])

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    setSavingPayment(true)
    try {
      const res = await fetch(`/api/schools/${id}/billing-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(paymentForm.amount),
          paymentType: paymentForm.paymentType,
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod || undefined,
          referenceNumber: paymentForm.referenceNumber || undefined,
          notes: paymentForm.notes || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to record payment', 'error')
        return
      }

      setPaymentForm({
        amount: '',
        paymentType: 'ANNUAL',
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: '',
        referenceNumber: '',
        notes: '',
      })
      showToast('Payment recorded successfully', 'success')
      await Promise.all([fetchSchool(), fetchPayments()])
    } catch (error) {
      console.error('Failed to record payment:', error)
      showToast('Failed to record payment', 'error')
    } finally {
      setSavingPayment(false)
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm('Delete this payment record?')) return

    try {
      const res = await fetch(`/api/schools/${id}/billing-payments/${paymentId}`, { method: 'DELETE' })
      if (!res.ok) {
        showToast('Failed to delete payment', 'error')
        return
      }

      showToast('Payment deleted', 'success')
      await fetchPayments()
    } catch (error) {
      console.error('Failed to delete payment:', error)
      showToast('Failed to delete payment', 'error')
    }
  }

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

  const billing = school?.schoolBilling
  const licenseDaysRemaining = daysUntil(billing?.licenseEndDate)
  const annualDue = (billing?.annualPricePerStudent ?? 0) * (billing?.licensedStudentCount ?? 0)

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
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/super-admin/schools')}>Back to schools</Button>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">{school?.name || 'School details'}</h1>
            <p className="text-gray-600 mt-1">Licensing, payments, renewals, and operational stats.</p>
          </div>
        </div>

        {loading || !school ? (
          <Card className="p-6">Loading...</Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Students</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{school._count.students}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Licensed seats</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{billing?.licensedStudentCount ?? 0}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Annual due</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{usd(annualDue)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide">License renewal</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {licenseDaysRemaining === null ? 'N/A' : `${licenseDaysRemaining}d`}
                </p>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-5 lg:col-span-2">
                <h2 className="text-lg font-semibold text-gray-900">School profile</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                  <div>
                    <p className="text-gray-500">Plan</p>
                    <p className="font-medium text-gray-900">{school.plan}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <p className="font-medium text-gray-900">{school.active ? 'Active' : 'Inactive'}{school.suspended ? ' · Suspended' : ''}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Created</p>
                    <p className="font-medium text-gray-900">{new Date(school.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Users / Classes / Subjects</p>
                    <p className="font-medium text-gray-900">{school._count.users} / {school._count.classes} / {school._count.subjects}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Student courses</p>
                    <p className="font-medium text-gray-900">{school.schoolSettings?.videoCoursesEnabled !== false ? 'Enabled' : 'Disabled'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Inter-school courses</p>
                    <p className="font-medium text-gray-900">{school.schoolSettings?.allowCrossSchoolCourses ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>
                {school.suspensionReason && (
                  <div className="mt-4 rounded-lg bg-orange-50 border border-orange-200 p-3">
                    <p className="text-sm text-orange-700"><span className="font-semibold">Suspension reason:</span> {school.suspensionReason}</p>
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <h2 className="text-lg font-semibold text-gray-900">License & billing</h2>
                <div className="space-y-2 text-sm mt-4">
                  <p><span className="text-gray-500">Onboarding status:</span> <span className="font-medium">{billing?.onboardingStatus ?? 'PENDING'}</span></p>
                  <p><span className="text-gray-500">Onboarding fee (USD):</span> <span className="font-medium">{usd(billing?.onboardingFee ?? 0)}</span></p>
                  <p><span className="text-gray-500">Annual / student (USD):</span> <span className="font-medium">{usd(billing?.annualPricePerStudent ?? 0)}</span></p>
                  <p><span className="text-gray-500">Billing year:</span> <span className="font-medium">{billing?.billingYear ?? new Date().getFullYear()}</span></p>
                  <p><span className="text-gray-500">License start:</span> <span className="font-medium">{billing?.licenseStartDate ? new Date(billing.licenseStartDate).toLocaleDateString() : 'N/A'}</span></p>
                  <p><span className="text-gray-500">License end:</span> <span className="font-medium">{billing?.licenseEndDate ? new Date(billing.licenseEndDate).toLocaleDateString() : 'N/A'}</span></p>
                  <p><span className="text-gray-500">Payments total (USD):</span> <span className="font-medium">{usd(totalPaid)}</span></p>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-5 lg:col-span-1">
                <h2 className="text-lg font-semibold text-gray-900">Record payment</h2>
                <form onSubmit={handleRecordPayment} className="space-y-3 mt-4">
                  <Input label="Amount" type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
                  <Select
                    label="Payment type"
                    value={paymentForm.paymentType}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value })}
                    options={[
                      { value: 'ONBOARDING', label: 'Onboarding fee' },
                      { value: 'ANNUAL', label: 'Annual license' },
                      { value: 'ADJUSTMENT', label: 'Adjustment / credit' },
                    ]}
                  />
                  <Input label="Payment date" type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} required />
                  <Input label="Payment method" value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })} />
                  <Input label="Reference number" value={paymentForm.referenceNumber} onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })} />
                  <Input label="Notes" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
                  <Button type="submit" isLoading={savingPayment}>Save payment</Button>
                </form>
              </Card>

              <Card className="p-5 lg:col-span-2">
                <h2 className="text-lg font-semibold text-gray-900">Payment history</h2>
                <div className="mt-4 space-y-2">
                  {payments.length === 0 ? (
                    <p className="text-sm text-gray-500">No payments recorded yet.</p>
                  ) : (
                    payments.map((payment) => (
                      <div key={payment.id} className="flex items-start justify-between gap-4 rounded-lg border p-3 bg-white">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              payment.paymentType === 'ONBOARDING'
                                ? 'bg-blue-100 text-blue-700'
                                : payment.paymentType === 'ANNUAL'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-purple-100 text-purple-700'
                            }`}>
                              {payment.paymentType}
                            </span>
                            <span className="text-sm font-semibold text-gray-900">{usd(Number(payment.amount))}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(payment.paymentDate).toLocaleDateString()}
                            {payment.paymentMethod ? ` · ${payment.paymentMethod}` : ''}
                            {payment.referenceNumber ? ` · #${payment.referenceNumber}` : ''}
                          </p>
                          {payment.notes && <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>}
                        </div>
                        <button className="text-xs text-red-600 hover:text-red-800" onClick={() => handleDeletePayment(payment.id)}>
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
