'use client'

import { useEffect, useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { TrendingUp, AlertTriangle, Banknote, Target } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'
import { translateDashboardDynamic, translateText } from '@/lib/client-i18n'

const metricCards = [
  { key: 'totalCollected', label: 'Total Collected', icon: TrendingUp, color: '#34d399', format: 'currency' },
  { key: 'outstandingBalance', label: 'Outstanding Balance', icon: AlertTriangle, color: '#fbbf24', format: 'currency' },
  { key: 'collectedToday', label: 'Collected Today', icon: Banknote, color: '#6366f1', format: 'currency' },
  { key: 'termTarget', label: 'Year Target', icon: Target, color: '#94a3b8', format: 'currency' },
]

function formatRand(value) {
  return `R ${value.toLocaleString('en-ZA')}`
}

function FinancialSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <div className="xl:col-span-3 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[124px] animate-pulse rounded-2xl border" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }} />
          ))}
        </div>
        <div className="h-[52px] animate-pulse rounded-xl border" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }} />
      </div>
      <div className="xl:col-span-2 h-[340px] animate-pulse rounded-2xl border" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }} />
    </div>
  )
}

export default function FinancialSection({ data, loading }) {
  const { locale } = useLocale()
  const [progress, setProgress] = useState(0)
  const progressLabel = translateDashboardDynamic(data.progressLabel || `${data.progressPercent}%`, locale)
  const paymentMethodsTotal = Number.isFinite(Number(data.paymentMethodsTotal))
    ? Number(data.paymentMethodsTotal)
    : Number(data.totalCollected?.value || 0)

  useEffect(() => {
    if (loading) return
    const timer = window.setTimeout(() => setProgress(data.progressPercent), 120)
    return () => window.clearTimeout(timer)
  }, [loading, data.progressPercent])

  if (loading) return <FinancialSkeleton />

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <div className="xl:col-span-3 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {metricCards.map((card) => {
            const metric = data[card.key]
            const Icon = card.icon
            return (
              <div
                key={card.key}
                className="rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)', boxShadow: '0 10px 30px rgba(0,0,0,0.28)' }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-wide text-slate-400">{translateText(card.label, locale)}</p>
                    <p className="mt-2 text-2xl font-extrabold" style={{ color: card.color }}>{formatRand(metric.value)}</p>
                    <p className="mt-1 text-xs text-slate-500">{translateDashboardDynamic(metric.sub, locale)}</p>
                  </div>
                  <div className="rounded-xl p-2" style={{ background: `${card.color}1A`, border: `1px solid ${card.color}40` }}>
                    <Icon className="h-4 w-4" style={{ color: card.color }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="rounded-2xl border p-4" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">{translateText('Fee Collection Progress', locale)}</p>
            <p className="text-xs text-slate-400">{progressLabel}</p>
          </div>
          <div className="h-2 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-2 rounded-full"
              style={{
                width: `${progress}%`,
                background: '#34d399',
                transition: 'width 1000ms ease-out',
              }}
            />
          </div>
        </div>
      </div>

      <div className="xl:col-span-2 rounded-2xl border p-4" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
        <p className="text-sm font-semibold text-slate-200">{translateText('Payment Method Breakdown', locale)}</p>
        <div className="mt-3 h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.paymentMethods}
                dataKey="percent"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={64}
                outerRadius={92}
                stroke="none"
                paddingAngle={2}
              >
                {data.paymentMethods.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name, props) => [translateDashboardDynamic(`${props.payload.amount.toLocaleString('en-ZA')} (${props.payload.count} payments)`, locale), translateText(String(name), locale)]}
                contentStyle={{ background: '#161924', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="-mt-[150px] text-center pointer-events-none">
            <p className="text-xs text-slate-400">{translateText('Total', locale)}</p>
            <p className="text-xl font-extrabold text-slate-100">{formatRand(paymentMethodsTotal)}</p>
          </div>
        </div>

        <div className="mt-1 space-y-2">
          {data.paymentMethods.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
                <span className="text-slate-300">{translateText(entry.name, locale)}</span>
              </div>
              <span className="text-slate-400">{entry.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
