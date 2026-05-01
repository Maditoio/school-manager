'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ADMIN_NAV_ITEMS, FINANCE_MANAGER_NAV_ITEMS } from '@/lib/admin-nav'

interface BillingInfo {
  onboardingFee: number
  onboardingStatus: 'PENDING' | 'PAID'
  annualPricePerStudent: number
  licensedStudentCount: number
  billingYear: number
}

interface BillingPayment {
  id: string
  amount: number
  paymentType: 'ONBOARDING' | 'ANNUAL' | 'ADJUSTMENT'
  paymentDate: string
  paymentMethod: string | null
  referenceNumber: string | null
  notes: string | null
  recordedBy: { id: string; firstName: string | null; lastName: string | null; email: string }
}

function formatUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function BillingManagementPage() {
  const { data: session, status } = useSession()
  const [schoolId, setSchoolId] = useState<string | null>(null)

  const [billing, setBilling] = useState<BillingInfo | null>(null)
  const [payments, setPayments] = useState<BillingPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [studentCount, setStudentCount] = useState(1)
  const [licenseYear, setLicenseYear] = useState(new Date().getFullYear())
  const [processingLicense, setProcessingLicense] = useState(false)
  const [processingOnboarding, setProcessingOnboarding] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (
      status === 'authenticated' &&
      !['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE', 'FINANCE_MANAGER'].includes(session?.user?.role)
    ) {
      redirect('/login')
    }
    if (session?.user?.schoolId) {
      setSchoolId(session.user.schoolId)
    }
  }, [session, status])

  const fetchBillingInfo = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/schools/${schoolId}/billing-payments`)
      if (!res.ok) throw new Error('Failed to load billing info')
      const data = await res.json()

      // Extract billing info from the response
      setBilling({
        onboardingFee: data.onboardingStatus ? 0 : 99.99, // Mock value, would come from schoolBilling
        onboardingStatus: data.onboardingStatus || 'PENDING',
        annualPricePerStudent: 50, // Mock value
        licensedStudentCount: data.licensedStudentCount || 0,
        billingYear: new Date().getFullYear(),
      })
      setPayments(data.payments || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing info')
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    if (schoolId) {
      fetchBillingInfo()
    }
  }, [schoolId, fetchBillingInfo])

  const handlePayLicenseFee = async () => {
    if (!schoolId || studentCount <= 0) return

    setProcessingLicense(true)
    try {
      const res = await fetch(`/api/schools/${schoolId}/licenses/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentCount,
          licenseYear,
          notes: `License payment for ${studentCount} students`,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Error: ${data.error || 'Failed to initiate license payment'}`)
        return
      }
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      alert('Failed to initiate license payment')
    } finally {
      setProcessingLicense(false)
    }
  }

  const handlePayOnboardingFee = async () => {
    if (!schoolId || !billing || billing.onboardingStatus === 'PAID') return

    setProcessingOnboarding(true)
    try {
      const res = await fetch(`/api/schools/${schoolId}/onboarding/checkout`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Error: ${data.error || 'Failed to initiate onboarding payment'}`)
        return
      }
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      alert('Failed to initiate onboarding payment')
    } finally {
      setProcessingOnboarding(false)
    }
  }

  if (status === 'loading' || !session) return null

  const navItems =
    session.user.role === 'FINANCE_MANAGER'
      ? FINANCE_MANAGER_NAV_ITEMS
      : session.user.role === 'FINANCE'
        ? ADMIN_NAV_ITEMS.filter((item) =>
            ['Fees', 'Licenses', 'Expenses', 'Fund Requests'].some((label) => item.label.includes(label))
          )
        : ADMIN_NAV_ITEMS

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session.user.role,
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold ui-text-primary">School Billing & Payments</h1>
          <p className="text-sm ui-text-secondary mt-1">Manage licenses, onboarding, and track payments</p>
        </div>

        {/* Summary Cards */}
        {billing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="ui-card p-4 rounded-lg border ui-border">
              <p className="text-xs ui-text-secondary font-medium uppercase tracking-wide">Licensed Students</p>
              <p className="text-2xl font-bold ui-text-primary mt-2">{billing.licensedStudentCount}</p>
              <p className="text-xs ui-text-secondary mt-1">
                {billing.annualPricePerStudent > 0
                  ? `${formatUSD(billing.annualPricePerStudent)}/student/year`
                  : 'Pricing not set'}
              </p>
            </div>

            <div
              className={`ui-card p-4 rounded-lg border ${
                billing.onboardingStatus === 'PAID' ? 'border-emerald-500/50' : 'ui-border'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs ui-text-secondary font-medium uppercase tracking-wide">Onboarding Fee</p>
                  <p className="text-2xl font-bold ui-text-primary mt-2">{formatUSD(billing.onboardingFee)}</p>
                </div>
                {billing.onboardingStatus === 'PAID' && (
                  <MaterialIcon name="check_circle" className="text-emerald-500 text-[28px]" />
                )}
              </div>
              <p
                className={`text-xs mt-2 font-medium ${
                  billing.onboardingStatus === 'PAID'
                    ? 'text-emerald-600'
                    : 'text-amber-600'
                }`}
              >
                Status: {billing.onboardingStatus}
              </p>
            </div>

            <div className="ui-card p-4 rounded-lg border ui-border">
              <p className="text-xs ui-text-secondary font-medium uppercase tracking-wide">Billing Year</p>
              <p className="text-2xl font-bold ui-text-primary mt-2">{billing.billingYear}</p>
            </div>
          </div>
        )}

        {/* License Payment Section */}
        <div className="ui-card rounded-lg border ui-border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MaterialIcon name="card_membership" className="text-blue-500 text-[24px]" />
            <h2 className="text-lg font-semibold ui-text-primary">License Fee Payment</h2>
          </div>

          <p className="text-sm ui-text-secondary">
            Purchase student licenses to enable system access. Each license covers one student for one year.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium ui-text-primary mb-1">Number of Students</label>
              <input
                type="number"
                min="1"
                value={studentCount}
                onChange={(e) => setStudentCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="ui-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium ui-text-primary mb-1">License Year</label>
              <input
                type="number"
                value={licenseYear}
                onChange={(e) => setLicenseYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="ui-input"
              />
            </div>
          </div>

          {billing && billing.annualPricePerStudent > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm">
                <span className="font-medium ui-text-primary">{studentCount} licenses:</span>{' '}
                <span className="text-lg font-bold text-blue-600">
                  {formatUSD(studentCount * billing.annualPricePerStudent)}
                </span>
              </p>
            </div>
          )}

          <Button
            onClick={handlePayLicenseFee}
            isLoading={processingLicense}
            className="w-full sm:w-auto"
          >
            <span className="inline-flex items-center gap-2">
              <MaterialIcon name="payment" className="text-[18px]" />
              Pay License Fee via Stripe
            </span>
          </Button>
        </div>

        {/* Onboarding Payment Section */}
        {billing && billing.onboardingStatus === 'PENDING' && (
          <div className="ui-card rounded-lg border ui-border p-6 space-y-4 bg-amber-50/50">
            <div className="flex items-center gap-2">
              <MaterialIcon name="build" className="text-amber-600 text-[24px]" />
              <h2 className="text-lg font-semibold ui-text-primary">Onboarding Fee</h2>
            </div>

            <p className="text-sm ui-text-secondary">
              Complete your school setup by paying the one-time onboarding fee to activate your account.
            </p>

            <div className="bg-amber-100 border border-amber-300 rounded-lg p-3">
              <p className="text-sm font-medium ui-text-primary">
                Amount Due: <span className="text-lg font-bold text-amber-700">{formatUSD(billing.onboardingFee)}</span>
              </p>
            </div>

            <Button
              onClick={handlePayOnboardingFee}
              isLoading={processingOnboarding}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              <span className="inline-flex items-center gap-2">
                <MaterialIcon name="payment" className="text-[18px]" />
                Pay Onboarding Fee via Stripe
              </span>
            </Button>
          </div>
        )}

        {/* Payment History */}
        <div className="ui-card rounded-lg border ui-border p-6 space-y-4">
          <h2 className="text-lg font-semibold ui-text-primary flex items-center gap-2">
            <MaterialIcon name="history" className="text-[20px]" />
            Payment History
          </h2>

          {loading ? (
            <div className="text-center py-8 ui-text-secondary">Loading payments...</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 ui-text-secondary">No payments recorded yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b ui-border">
                  <tr className="text-left">
                    <th className="pb-3 font-semibold ui-text-secondary">Date</th>
                    <th className="pb-3 font-semibold ui-text-secondary">Type</th>
                    <th className="pb-3 font-semibold ui-text-secondary text-right">Amount</th>
                    <th className="pb-3 font-semibold ui-text-secondary">Method</th>
                    <th className="pb-3 font-semibold ui-text-secondary">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y ui-border">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="py-3 ui-text-primary">
                        {new Date(payment.paymentDate).toLocaleDateString('en-US')}
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            payment.paymentType === 'ONBOARDING'
                              ? 'bg-blue-100 text-blue-700'
                              : payment.paymentType === 'ANNUAL'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {payment.paymentType}
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold ui-text-primary">{formatUSD(payment.amount)}</td>
                      <td className="py-3 ui-text-secondary">{payment.paymentMethod || '-'}</td>
                      <td className="py-3 text-xs ui-text-secondary">
                        {[payment.recordedBy.firstName, payment.recordedBy.lastName].filter(Boolean).join(' ') ||
                          payment.recordedBy.email}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
