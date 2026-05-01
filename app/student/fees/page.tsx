'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'

interface Invoice {
  id: string
  periodType: string
  year: number
  month: number | null
  semester: number | null
  amountDue: number
  dueDate: string
  status: 'PENDING' | 'OVERDUE' | 'PAID' | 'PARTIAL'
  totalPaid: number
  balance: number
  payments: Array<{ id: string; amountPaid: number; paymentDate: string; paymentMethod: string }>
}

type InvoiceStatus = 'PENDING' | 'OVERDUE' | 'PAID' | 'PARTIAL'

const statusStyle: Record<InvoiceStatus, string> = {
  PAID: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-slate-100 text-slate-700',
  OVERDUE: 'bg-rose-100 text-rose-700',
}

const statusLabels: Record<InvoiceStatus, string> = {
  PAID: 'Paid',
  PARTIAL: 'Partial',
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
}

function formatUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function StudentFeesPaymentPage() {
  const { data: session, status } = useSession()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'STUDENT') redirect('/login')
  }, [session, status])

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!session?.user) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/student/fees/invoices')
        if (!res.ok) {
          throw new Error('Failed to load invoices')
        }
        const data = await res.json()
        setInvoices(Array.isArray(data.invoices) ? data.invoices : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invoices')
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchInvoices()
    }
  }, [session])

  const handlePayNow = async (invoiceId: string) => {
    setPayingInvoice(invoiceId)
    try {
      const res = await fetch(`/api/student/fees/${invoiceId}/checkout`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Payment Error: ${data.error || 'Failed to initiate payment'}`)
        setPayingInvoice(null)
        return
      }
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      alert('Failed to initiate payment. Please try again.')
      setPayingInvoice(null)
    }
  }

  if (status === 'loading' || !session) return null

  const totalOutstanding = invoices
    .filter((inv) => inv.status !== 'PAID')
    .reduce((sum, inv) => sum + inv.balance, 0)

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Student',
        role: 'Student',
        email: session.user.email,
      }}
      navItems={STUDENT_NAV_ITEMS}
    >
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold ui-text-primary">School Fees</h1>
          <p className="text-sm ui-text-secondary mt-1">View and pay your outstanding school fees</p>
        </div>

        {/* Summary Cards */}
        {!loading && invoices.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="ui-card p-4 rounded-lg">
              <p className="text-xs ui-text-secondary font-medium uppercase tracking-wide">Total Outstanding</p>
              <p className="text-2xl font-bold ui-text-primary mt-1">{formatUSD(totalOutstanding)}</p>
            </div>
            <div className="ui-card p-4 rounded-lg">
              <p className="text-xs ui-text-secondary font-medium uppercase tracking-wide">Invoices</p>
              <p className="text-2xl font-bold ui-text-primary mt-1">{invoices.length}</p>
            </div>
            <div className="ui-card p-4 rounded-lg">
              <p className="text-xs ui-text-secondary font-medium uppercase tracking-wide">Total Paid</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {formatUSD(invoices.reduce((sum, inv) => sum + inv.totalPaid, 0))}
              </p>
            </div>
          </div>
        )}

        {/* Invoices Table */}
        {loading ? (
          <div className="text-center py-12 ui-text-secondary">Loading invoices...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <MaterialIcon name="check_circle" className="text-6xl text-emerald-500 mx-auto mb-3" />
            <p className="font-medium ui-text-primary">No outstanding fees</p>
            <p className="text-sm ui-text-secondary mt-1">Your school fees are all paid up</p>
          </div>
        ) : (
          <div className="ui-card rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="ui-text-secondary border-b ui-border bg-opacity-50">
                  <tr className="text-left">
                    <th className="p-4 font-semibold">Period</th>
                    <th className="p-4 font-semibold">Due Date</th>
                    <th className="p-4 font-semibold text-right">Amount Due</th>
                    <th className="p-4 font-semibold text-right">Balance</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y ui-border">
                  {invoices.map((invoice) => {
                    const periodLabel =
                      invoice.month != null
                        ? new Date(invoice.year, invoice.month - 1, 1).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })
                        : invoice.semester != null
                          ? `Semester ${invoice.semester} ${invoice.year}`
                          : `Year ${invoice.year}`

                    return (
                      <tr key={invoice.id} className="hover:bg-opacity-50 transition-colors">
                        <td className="p-4 font-medium ui-text-primary">{periodLabel}</td>
                        <td className="p-4 ui-text-secondary">
                          {new Date(invoice.dueDate).toLocaleDateString('en-US')}
                        </td>
                        <td className="p-4 text-right ui-text-primary font-medium">
                          {formatUSD(invoice.amountDue)}
                        </td>
                        <td className="p-4 text-right font-bold">
                          <span className={invoice.balance > 0 ? 'text-red-600' : 'text-emerald-600'}>
                            {formatUSD(invoice.balance)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                              statusStyle[invoice.status]
                            }`}
                          >
                            <MaterialIcon
                              name={
                                invoice.status === 'PAID'
                                  ? 'check_circle'
                                  : invoice.status === 'PARTIAL'
                                    ? 'schedule'
                                    : invoice.status === 'OVERDUE'
                                      ? 'priority_high'
                                      : 'schedule'
                              }
                              className="text-[14px]"
                            />
                            {statusLabels[invoice.status]}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {invoice.balance > 0 && invoice.status !== 'PAID' ? (
                            <Button
                              size="sm"
                              onClick={() => handlePayNow(invoice.id)}
                              isLoading={payingInvoice === invoice.id}
                              disabled={payingInvoice !== null && payingInvoice !== invoice.id}
                            >
                              Pay Now
                            </Button>
                          ) : (
                            <span className="text-xs ui-text-secondary">Paid</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment Notification */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <MaterialIcon name="info" className="text-blue-600 text-[20px] shrink-0 mt-0.5" />
            <div className="text-sm ui-text-secondary">
              <p className="font-medium text-blue-900 mb-1">Payment Processing</p>
              <p>
                Your payment is processed securely through Stripe. After successful payment, your invoice status will update
                automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
