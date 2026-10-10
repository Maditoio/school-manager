'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'
import { useStudentUi } from '@/lib/use-student-ui'

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
  PAID: 'bg-[#eafaf3] text-[#1b8a5a]',
  PARTIAL: 'bg-[#fff8e6] text-[#b07d00]',
  PENDING: 'bg-(--surface-soft) ui-text-secondary',
  OVERDUE: 'bg-[#fff0ee] text-[#c0392b]',
}

function formatUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function StudentFeesPaymentPage() {
  const { data: session, status } = useSession()
  const { locale, tStudent } = useStudentUi()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null)

  const statusLabels: Record<InvoiceStatus, string> = {
    PAID: tStudent('paid', 'Paid'),
    PARTIAL: tStudent('partial', 'Partial'),
    PENDING: tStudent('pending', 'Pending'),
    OVERDUE: tStudent('overdue', 'Overdue'),
  }

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
    } catch {
      alert('Failed to initiate payment. Please try again.')
      setPayingInvoice(null)
    }
  }

  if (status === 'loading' || !session) return null

  const totalOutstanding = invoices
    .filter((inv) => inv.status !== 'PAID')
    .reduce((sum, inv) => sum + inv.balance, 0)

  const dateLocale = locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-KE' : 'en-US'

  const periodLabel = (invoice: Invoice) =>
    invoice.month != null
      ? new Date(invoice.year, invoice.month - 1, 1).toLocaleDateString(dateLocale, {
          month: 'short',
          year: 'numeric',
        })
      : invoice.semester != null
        ? `Semester ${invoice.semester} ${invoice.year}`
        : `Year ${invoice.year}`

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Student',
        role: 'Student',
        email: session.user.email,
      }}
      navItems={STUDENT_NAV_ITEMS}
    >
      <div className="mx-auto max-w-4xl space-y-5 p-1 sm:p-0">
        <div>
          <h1 className="text-[20px] font-semibold ui-text-primary">
            {tStudent('schoolFees', 'School Fees')}
          </h1>
          <p className="mt-1 text-sm ui-text-secondary">
            {tStudent('feesSubtitle', 'View and pay your outstanding school fees')}
          </p>
        </div>

        {!loading && invoices.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="ui-card rounded-[10px] border border-(--border-subtle) bg-(--surface-card) p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
                {tStudent('totalOutstanding', 'Total Outstanding')}
              </p>
              <p className="mt-1 text-2xl font-semibold ui-text-primary">{formatUSD(totalOutstanding)}</p>
            </div>
            <div className="ui-card rounded-[10px] border border-(--border-subtle) bg-(--surface-card) p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
                {tStudent('invoices', 'Invoices')}
              </p>
              <p className="mt-1 text-2xl font-semibold ui-text-primary">{invoices.length}</p>
            </div>
            <div className="ui-card rounded-[10px] border border-(--border-subtle) bg-(--surface-card) p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
                {tStudent('totalPaid', 'Total Paid')}
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#1b8a5a]">
                {formatUSD(invoices.reduce((sum, inv) => sum + inv.totalPaid, 0))}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center ui-text-secondary">
            {tStudent('loadingInvoices', 'Loading invoices...')}
          </div>
        ) : error ? (
          <div className="rounded-[10px] border border-(--border-subtle) bg-[#fff0ee] p-4 text-[#c0392b]">
            {error}
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-12 text-center">
            <MaterialIcon name="check_circle" className="mx-auto mb-3 text-6xl text-[#1b8a5a]" />
            <p className="font-medium ui-text-primary">
              {tStudent('noOutstandingFees', 'No outstanding fees')}
            </p>
            <p className="mt-1 text-sm ui-text-secondary">
              {tStudent('feesAllPaid', 'Your school fees are all paid up')}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="rounded-[10px] border border-(--border-subtle) bg-(--surface-card) p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold ui-text-primary">{periodLabel(invoice)}</p>
                      <p className="mt-1 text-xs ui-text-secondary">
                        {tStudent('dueDate', 'Due Date')}:{' '}
                        {new Date(invoice.dueDate).toLocaleDateString(dateLocale)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[invoice.status]}`}
                    >
                      {statusLabels[invoice.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.07em] ui-text-secondary">
                        {tStudent('balance', 'Balance')}
                      </p>
                      <p
                        className={`text-lg font-semibold ${
                          invoice.balance > 0 ? 'text-[#c0392b]' : 'text-[#1b8a5a]'
                        }`}
                      >
                        {formatUSD(invoice.balance)}
                      </p>
                    </div>
                    {invoice.balance > 0 && invoice.status !== 'PAID' ? (
                      <Button
                        className="min-h-11"
                        onClick={() => handlePayNow(invoice.id)}
                        isLoading={payingInvoice === invoice.id}
                        disabled={payingInvoice !== null && payingInvoice !== invoice.id}
                      >
                        {tStudent('payNow', 'Pay Now')}
                      </Button>
                    ) : (
                      <span className="text-xs ui-text-secondary">{tStudent('paid', 'Paid')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-[10px] border border-(--border-subtle) bg-(--surface-card) md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-(--border-subtle) text-left">
                      <th className="p-4 text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
                        {tStudent('period', 'Period')}
                      </th>
                      <th className="p-4 text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
                        {tStudent('dueDate', 'Due Date')}
                      </th>
                      <th className="p-4 text-right text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
                        {tStudent('amountDue', 'Amount Due')}
                      </th>
                      <th className="p-4 text-right text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
                        {tStudent('balance', 'Balance')}
                      </th>
                      <th className="p-4 text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
                        {tStudent('status', 'Status')}
                      </th>
                      <th className="p-4 text-right text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
                        {tStudent('action', 'Action')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--border-subtle)">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-(--surface-soft)">
                        <td className="p-4 font-medium ui-text-primary">{periodLabel(invoice)}</td>
                        <td className="p-4 ui-text-secondary">
                          {new Date(invoice.dueDate).toLocaleDateString(dateLocale)}
                        </td>
                        <td className="p-4 text-right font-semibold ui-text-primary">
                          {formatUSD(invoice.amountDue)}
                        </td>
                        <td className="p-4 text-right font-semibold">
                          <span className={invoice.balance > 0 ? 'text-[#c0392b]' : 'text-[#1b8a5a]'}>
                            {formatUSD(invoice.balance)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[invoice.status]}`}
                          >
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
                              {tStudent('payNow', 'Pay Now')}
                            </Button>
                          ) : (
                            <span className="text-xs ui-text-secondary">{tStudent('paid', 'Paid')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="rounded-[10px] border border-(--border-subtle) bg-(--surface-card) p-4">
          <div className="flex gap-3">
            <MaterialIcon name="info" className="mt-0.5 shrink-0 text-[20px] text-[#635bff]" />
            <div className="text-sm ui-text-secondary">
              <p className="mb-1 font-medium ui-text-primary">
                {tStudent('paymentProcessing', 'Payment Processing')}
              </p>
              <p>
                {tStudent(
                  'paymentProcessingNote',
                  'Your payment is processed securely through Stripe. After successful payment, your invoice status will update automatically.'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
