'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Info, XCircle, X } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'
import { translateDashboardDynamic, translateText } from '@/lib/client-i18n'

const severityConfig = {
  danger: { color: '#ef4444', icon: XCircle },
  warning: { color: '#fbbf24', icon: AlertTriangle },
  info: { color: '#38bdf8', icon: Info },
}

function AlertsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[86px] animate-pulse rounded-xl border" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }} />
      ))}
    </div>
  )
}

export default function AlertsSection({ data, loading }) {
  const { locale } = useLocale()
  const [dismissed, setDismissed] = useState({})
  const [dismissing, setDismissing] = useState({})

  const dismissAlert = (id) => {
    setDismissing((prev) => ({ ...prev, [id]: true }))
    window.setTimeout(() => {
      setDismissed((prev) => ({ ...prev, [id]: true }))
      setDismissing((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }, 250)
  }
  const activeAlerts = useMemo(() => {
    const severityWeight = { danger: 0, warning: 1, info: 2 }
    return data
      .filter((item) => !dismissed[item.id])
      .sort((a, b) => severityWeight[a.severity] - severityWeight[b.severity])
  }, [data, dismissed])

  if (loading) return <AlertsSkeleton />

  const openAction = (alert) => {
    if (alert.actionHref) {
      window.location.assign(alert.actionHref)
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-200">{translateText('Alerts Requiring Attention', locale)}</p>
        <span className="rounded-full border px-2 py-1 text-xs text-slate-300" style={{ borderColor: 'rgba(255,255,255,0.12)', background: '#161924' }}>
          {translateDashboardDynamic(`${activeAlerts.length} alerts`, locale)}
        </span>
      </div>

      {activeAlerts.length === 0 ? (
        <div className="rounded-xl border p-4 text-sm font-medium text-emerald-300" style={{ background: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.32)' }}>
          {translateText('✓ No issues detected · School is running smoothly', locale)}
        </div>
      ) : (
        <div className="space-y-3">
          {activeAlerts.map((alert) => {
            const cfg = severityConfig[alert.severity]
            const Icon = cfg.icon
            const isDismissing = !!dismissing[alert.id]
            return (
              <div
                key={alert.id}
                className="overflow-hidden rounded-xl border transition-all duration-200"
                style={{
                  background: '#111420',
                  borderColor: 'rgba(255,255,255,0.07)',
                  borderLeft: `3px solid ${cfg.color}`,
                  maxHeight: isDismissing ? 0 : 140,
                  opacity: isDismissing ? 0 : 1,
                  transform: isDismissing ? 'translateY(-4px)' : 'translateY(0)',
                  marginTop: isDismissing ? 0 : undefined,
                  marginBottom: isDismissing ? 0 : undefined,
                }}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: `${cfg.color}22` }}>
                    <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-slate-100">{translateDashboardDynamic(alert.message, locale)}</p>
                    <p className="text-xs text-slate-500">{translateDashboardDynamic(alert.context, locale)}</p>
                  </div>

                  <button
                    className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' }}
                    onClick={() => openAction(alert)}
                  >
                    {translateText(alert.action, locale)}
                  </button>

                  <button
                    aria-label="Dismiss alert"
                    className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-slate-300"
                    onClick={() => dismissAlert(alert.id)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
