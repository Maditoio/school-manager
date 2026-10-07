'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import {
  ADMIN_NAV_ITEMS,
  DEPUTY_ADMIN_NAV_ITEMS,
  FINANCE_MANAGER_NAV_ITEMS,
  FINANCE_NAV_ITEMS,
} from '@/lib/admin-nav'

interface InvoiceInfo {
  onboardingFee: number
  onboardingStatus: 'PENDING' | 'PAID' | 'WAIVED'
  annualPricePerStudent: number
  billingYear: number
  activeStudents: number
  invoiceAmount: number
  amountPaid: number
  outstanding: number
}

interface BillingPayment {
  id: string
  amount: number
  paymentType: 'ONBOARDING' | 'ANNUAL' | 'ADJUSTMENT'
  paymentDate: string
  paymentMethod: string | null
  referenceNumber: string | null
  recordedBy: { id: string; firstName: string | null; lastName: string | null; email: string } | null
}

function formatUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function SchoolInvoicePage() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<InvoiceInfo | null>(null)
  const [payments, setPayments] = useState<BillingPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingInvoice, setProcessingInvoice] = useState(false)
  const [processingOnboarding, setProcessingOnboarding] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (
      status === 'authenticated' &&
      !['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE', 'FINANCE_MANAGER'].includes(session?.user?.role ?? '')
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
      if (!res.ok) throw new Error('Failed to load the school invoice')
      const data = await res.json()
      setInvoice({
        onboardingFee: Number(data.onboardingFee ?? 0),
        onboardingStatus: data.onboardingStatus || 'PENDING',
        annualPricePerStudent: Number(data.annualPricePerStudent ?? 0),
        billingYear: Number(data.billingYear ?? new Date().getFullYear()),
        activeStudents: Number(data.activeStudents ?? 0),
        invoiceAmount: Number(data.invoiceAmount ?? 0),
        amountPaid: Number(data.amountPaid ?? 0),
        outstanding: Number(data.outstanding ?? 0),
      })
      setPayments(data.payments || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the school invoice')
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    if (schoolId) fetchBillingInfo()
  }, [schoolId, fetchBillingInfo])

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (!schoolId || !sessionId) return

    let cancelled = false
    async function completePayment() {
      const res = await fetch(
        `/api/schools/${schoolId}/licenses/checkout/complete?sessionId=${encodeURIComponent(sessionId!)}`
      )
      if (cancelled) return
      if (res.ok) {
        await fetchBillingInfo()
      }
      router.replace(pathname)
    }

    completePayment()
    return () => {
      cancelled = true
    }
  }, [schoolId, searchParams, fetchBillingInfo, pathname, router])

  const handlePayInvoice = async () => {
    if (!schoolId || !invoice || invoice.outstanding <= 0) return
    setProcessingInvoice(true)
    try {
      const res = await fetch(`/api/schools/${schoolId}/licenses/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath: pathname }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start payment')
        return
      }
      if (data.url) window.location.href = data.url
    } catch {
      setError('Failed to start payment')
    } finally {
      setProcessingInvoice(false)
    }
  }

  const handlePayOnboardingFee = async () => {
    if (!schoolId || !invoice || invoice.onboardingStatus === 'PAID' || invoice.onboardingStatus === 'WAIVED') return
    setProcessingOnboarding(true)
    try {
      const res = await fetch(`/api/schools/${schoolId}/onboarding/checkout`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start onboarding payment')
        return
      }
      if (data.url) window.location.href = data.url
    } catch {
      setError('Failed to start onboarding payment')
    } finally {
      setProcessingOnboarding(false)
    }
  }

  if (status === 'loading' || !session) return null

  const navItems =
    session.user.role === 'FINANCE_MANAGER'
      ? FINANCE_MANAGER_NAV_ITEMS
      : session.user.role === 'FINANCE'
        ? FINANCE_NAV_ITEMS
        : session.user.role === 'DEPUTY_ADMIN'
          ? DEPUTY_ADMIN_NAV_ITEMS
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
        <div>
          <h1 className="text-[20px] font-semibold" style={{ color: '#0a2540' }}>School invoice</h1>
          <p className="text-sm mt-1" style={{ color: '#8898aa' }}>
            One annual charge for this school: active students times the price per student.
          </p>
        </div>

        {error && (
          <div className="rounded-md border px-4 py-3 text-sm" style={{ borderColor: '#fa755a', background: '#fff0ee', color: '#c0392b' }}>
            {error}
          </div>
        )}

        {loading || !invoice ? (
          <p className="text-sm" style={{ color: '#8898aa' }}>Loading invoice...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border p-4" style={{ borderColor: '#e0e6ed', borderRadius: 10 }}>
                <p className="text-[11px] uppercase tracking-[0.07em]" style={{ color: '#8898aa' }}>Active students</p>
                <p className="text-2xl font-semibold mt-2" style={{ color: '#0a2540' }}>{invoice.activeStudents}</p>
                <p className="text-xs mt-1" style={{ color: '#8898aa' }}>
                  {invoice.annualPricePerStudent > 0
                    ? `${formatUSD(invoice.annualPricePerStudent)} each`
                    : 'Price not set'}
                </p>
              </div>
              <div className="bg-white border p-4" style={{ borderColor: '#e0e6ed', borderRadius: 10 }}>
                <p className="text-[11px] uppercase tracking-[0.07em]" style={{ color: '#8898aa' }}>Invoice {invoice.billingYear}</p>
                <p className="text-2xl font-semibold mt-2" style={{ color: '#0a2540' }}>{formatUSD(invoice.invoiceAmount)}</p>
                <p className="text-xs mt-1" style={{ color: '#8898aa' }}>Paid {formatUSD(invoice.amountPaid)}</p>
              </div>
              <div className="bg-white border p-4" style={{ borderColor: '#e0e6ed', borderRadius: 10 }}>
                <p className="text-[11px] uppercase tracking-[0.07em]" style={{ color: '#8898aa' }}>Outstanding</p>
                <p className="text-2xl font-semibold mt-2" style={{ color: invoice.outstanding > 0 ? '#c0392b' : '#1b8a5a' }}>
                  {formatUSD(invoice.outstanding)}
                </p>
                <p className="text-xs mt-1" style={{ color: '#8898aa' }}>
                  {invoice.outstanding > 0 ? 'Unpaid' : 'Paid'}
                </p>
              </div>
            </div>

            <div className="bg-white border p-5 space-y-4" style={{ borderColor: '#e0e6ed', borderRadius: 10 }}>
              <h2 className="text-sm font-semibold" style={{ color: '#0a2540' }}>Annual invoice</h2>
              <p className="text-sm" style={{ color: '#8898aa' }}>
                {invoice.activeStudents} active {invoice.activeStudents === 1 ? 'student' : 'students'} × {formatUSD(invoice.annualPricePerStudent)} = {formatUSD(invoice.invoiceAmount)}.
              </p>
              <Button onClick={handlePayInvoice} isLoading={processingInvoice} disabled={invoice.outstanding <= 0}>
                {invoice.outstanding > 0 ? `Pay ${formatUSD(invoice.outstanding)}` : 'Invoice paid'}
              </Button>
            </div>

            {invoice.onboardingStatus === 'PENDING' && invoice.onboardingFee > 0 && (
              <div className="bg-white border p-5 space-y-3" style={{ borderColor: '#e0e6ed', borderRadius: 10 }}>
                <h2 className="text-sm font-semibold" style={{ color: '#0a2540' }}>Onboarding fee</h2>
                <p className="text-sm" style={{ color: '#8898aa' }}>One-time setup fee of {formatUSD(invoice.onboardingFee)}.</p>
                <button
                  type="button"
                  onClick={handlePayOnboardingFee}
                  disabled={processingOnboarding}
                  className="text-sm font-medium"
                  style={{ color: '#635bff' }}
                >
                  {processingOnboarding ? 'Starting payment...' : 'Pay onboarding fee →'}
                </button>
              </div>
            )}
          </>
        )}

        <div className="bg-white border p-5" style={{ borderColor: '#e0e6ed', borderRadius: 10 }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#0a2540' }}>Payments</h2>
          {payments.length === 0 ? (
            <p className="text-sm" style={{ color: '#8898aa' }}>No payments recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-[11px] uppercase tracking-[0.07em] pb-2" style={{ color: '#8898aa' }}>Date</th>
                  <th className="text-left text-[11px] uppercase tracking-[0.07em] pb-2" style={{ color: '#8898aa' }}>Type</th>
                  <th className="text-right text-[11px] uppercase tracking-[0.07em] pb-2" style={{ color: '#8898aa' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t" style={{ borderColor: '#e0e6ed' }}>
                    <td className="py-2" style={{ color: '#0a2540' }}>{new Date(payment.paymentDate).toLocaleDateString('en-US')}</td>
                    <td className="py-2" style={{ color: '#0a2540' }}>{payment.paymentType}</td>
                    <td className="py-2 text-right font-semibold" style={{ color: '#0a2540' }}>{formatUSD(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
