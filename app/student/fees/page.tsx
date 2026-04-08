'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'

interface FeePayment {
  id: string
  amountPaid: number
  paymentDate: string
  paymentMethod: string | null
  paymentNumber: string | null
  notes: string | null
}

interface FeeSchedule {
  id: string
  periodType: string
  year: number
  month: number | null
  semester: number | null
  amountDue: number
  createdAt: string
  payments: FeePayment[]
  totalPaid: number
  balance: number
  feeStatus: 'PAID' | 'PARTIAL' | 'UNPAID'
}

interface FeesResponse {
  schedules: FeeSchedule[]
  totalOutstanding: number
}

const statusStyle: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  UNPAID: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  PAID: 'PAYÉ',
  PARTIAL: 'PARTIEL',
  UNPAID: 'IMPAYÉ',
}

const periodTypeLabels: Record<string, string> = {
  MONTHLY: 'Mensuel',
  SEMESTER: 'Semestriel',
  ANNUAL: 'Annuel',
  TERM: 'Trimestre',
  WEEKLY: 'Hebdomadaire',
}

export default function StudentFeesPage() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<FeesResponse | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'STUDENT') redirect('/login')
  }, [session, status])

  useEffect(() => {
    const load = async () => {
      if (!session?.user) return
      try {
        setLoading(true)
        setError('')
        const res = await fetch('/api/student/fees')
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error || 'Échec du chargement des frais')
          return
        }
        setData(await res.json())
      } catch {
        setError('Échec du chargement des frais')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session])

  if (status === 'loading' || !session) return null

  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Étudiant',
        role: 'Étudiant',
        email: session.user.email,
      }}
      navItems={STUDENT_NAV_ITEMS}
    >
      <div className="space-y-4">
        <h1 className="text-lg font-semibold ui-text-primary">Frais Scolaires</h1>

        {loading ? (
          <div className="ui-surface p-6 flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent)" />
            <p className="text-sm ui-text-secondary">Chargement des frais...</p>
          </div>
        ) : error ? (
          <div className="ui-surface p-5">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : data ? (
          <>
            {/* Summary banner */}
            <div className="ui-surface p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider ui-text-secondary">Total Dû</p>
                <p className={`text-xl font-bold mt-0.5 ${data.totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {data.totalOutstanding > 0 ? `${fmt(data.totalOutstanding)}` : 'Tous les frais sont réglés'}
                </p>
              </div>
              <div className="flex gap-3 text-center">
                <div>
                  <p className="text-lg font-bold ui-text-primary">{data.schedules.length}</p>
                  <p className="text-[11px] ui-text-secondary">Échéanciers</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">
                    {data.schedules.filter(s => s.feeStatus === 'PAID').length}
                  </p>
                  <p className="text-[11px] ui-text-secondary">Payé</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-600">
                    {data.schedules.filter(s => s.feeStatus !== 'PAID').length}
                  </p>
                  <p className="text-[11px] ui-text-secondary">Impayé</p>
                </div>
              </div>
            </div>

            {data.schedules.length === 0 ? (
              <div className="ui-surface p-8 text-center">
                <p className="text-sm ui-text-secondary">Aucun échéancier trouvé.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.schedules.map(schedule => (
                  <div key={schedule.id} className="ui-surface overflow-hidden">
                    {/* Schedule header */}
                    <button
                      onClick={() => setExpandedId(expandedId === schedule.id ? null : schedule.id)}
                      className="w-full p-4 flex items-center justify-between gap-3 text-left hover:opacity-80 transition-opacity"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold ui-text-primary">
                          {periodTypeLabels[schedule.periodType] ?? schedule.periodType} · {schedule.year}
                          {schedule.month != null ? ` · Mois ${schedule.month}` : ''}
                          {schedule.semester != null ? ` · Semestre ${schedule.semester}` : ''}
                        </p>
                        <p className="text-xs ui-text-secondary mt-0.5">
                          Créé le {new Date(schedule.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold ui-text-primary">{fmt(schedule.amountDue)}</p>
                          <p className="text-[11px] ui-text-secondary">Solde : {fmt(schedule.balance)}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle[schedule.feeStatus]}`}>
                          {statusLabels[schedule.feeStatus] ?? schedule.feeStatus}
                        </span>
                        <span className="text-xs ui-text-secondary">{expandedId === schedule.id ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {/* Payment history */}
                    {expandedId === schedule.id && (
                      <div className="border-t border-(--border-subtle) px-4 pb-4 pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wider ui-text-secondary mb-2">
                          Historique des paiements
                        </p>
                        {schedule.payments.length === 0 ? (
                          <p className="text-sm ui-text-secondary py-2">Aucun paiement enregistré.</p>
                        ) : (
                          <div className="overflow-auto rounded-lg border border-(--border-subtle)">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-(--border-subtle)" style={{ background: 'var(--surface-soft)' }}>
                                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider ui-text-secondary">Date</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider ui-text-secondary">Mode</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider ui-text-secondary">Réf. #</th>
                                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider ui-text-secondary">Montant</th>
                                </tr>
                              </thead>
                              <tbody>
                                {schedule.payments.map(p => (
                                  <tr key={p.id} className="border-b border-(--border-subtle) last:border-0">
                                    <td className="px-3 py-2.5 text-xs ui-text-primary">{new Date(p.paymentDate).toLocaleDateString('fr-FR')}</td>
                                    <td className="px-3 py-2.5 text-xs ui-text-secondary">{p.paymentMethod ?? 'N/A'}</td>
                                    <td className="px-3 py-2.5 text-xs ui-text-secondary">{p.paymentNumber ?? '-'}</td>
                                    <td className="px-3 py-2.5 text-right text-sm font-semibold text-green-600">{fmt(p.amountPaid)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="mt-3 flex justify-end gap-6 text-sm">
                          <span className="ui-text-secondary">Total payé : <strong className="text-green-600">{fmt(schedule.totalPaid)}</strong></span>
                          <span className="ui-text-secondary">Solde : <strong className={schedule.balance > 0 ? 'text-red-600' : 'text-green-600'}>{fmt(schedule.balance)}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
