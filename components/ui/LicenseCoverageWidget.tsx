'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, ShieldCheck, ShieldAlert, Banknote, Clock } from 'lucide-react'

interface LicenseStatus {
  configured: boolean
  onboardingStatus: string
  onboardingFee: number
  annualPricePerStudent: number
  licensedStudentCount: number
  bulkLicensedStudentCount?: number
  activeStudents: number
  coveredStudents: number
  uncoveredStudents: number
  bulkCoveredStudents?: number
  extraCoveredStudents?: number
  studentsWithAccess?: number
  studentsWithoutAccess?: number
  studentsNeedingExtraLicensePayment?: number
  requiredAmountPerStudent?: number
  extraLicenseCost?: number
  licenseYear?: number
  billingYear: number
  licenseStartDate: string | null
  licenseEndDate: string | null
}

interface Props {
  /** Link to the fees page for "View Details" */
  feesHref?: string
  /** Extra class names for the outer container */
  className?: string
}

function Skeleton() {
  return (
    <div
      className="rounded-2xl border p-4 space-y-3 animate-pulse"
      style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      <div className="h-4 w-40 rounded bg-slate-700" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-700" />
        ))}
      </div>
    </div>
  )
}

export default function LicenseCoverageWidget({ feesHref = '/admin/fees', className = '' }: Props) {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [todayMs] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    fetch('/api/fees?page=1&limit=1', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.licenseSummary) return
        setStatus(data.licenseSummary)
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <Skeleton />
  if (!status) return null

  const withAccess = status.studentsWithAccess ?? status.coveredStudents
  const withoutAccess = status.studentsWithoutAccess ?? status.uncoveredStudents
  const bulkSeats = status.bulkLicensedStudentCount ?? status.licensedStudentCount

  const coveragePercent =
    status.activeStudents > 0
      ? Math.min(100, Math.round((withAccess / status.activeStudents) * 100))
      : 0

  const hasBlockedStudents = withoutAccess > 0
  const isExpiringSoon = (() => {
    if (!status.licenseEndDate) return false
    const end = new Date(status.licenseEndDate)
    const diff = Math.ceil((end.getTime() - todayMs) / (1000 * 60 * 60 * 24))
    return diff >= 0 && diff <= 30
  })()

  const onboardingBadge = {
    PAID: { label: 'Paid', color: '#34d399', bg: '#34d39918' },
    WAIVED: { label: 'Waived', color: '#a78bfa', bg: '#a78bfa18' },
    PENDING: { label: 'Pending', color: '#fbbf24', bg: '#fbbf2418' },
  }[status.onboardingStatus] ?? { label: status.onboardingStatus, color: '#94a3b8', bg: '#94a3b818' }

  return (
    <div
      className={`rounded-2xl border p-4 ${className}`}
      style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)', boxShadow: '0 10px 30px rgba(0,0,0,0.28)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-200">School License Coverage</p>
          {isExpiringSoon && (
            <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: '#fbbf2418', color: '#fbbf24' }}>
              <Clock className="h-3 w-3" />
              Expiring soon
            </span>
          )}
        </div>
        <Link
          href={feesHref}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--accent, #6366f1)' }}
        >
          View Details
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <StatTile
          label="Bulk Seats"
          value={bulkSeats}
          icon={<ShieldCheck className="h-4 w-4" style={{ color: '#34d399' }} />}
          accent="#34d399"
          sub={`${status.licenseYear ?? status.billingYear ?? '—'}`}
        />
        <StatTile
          label="Covered"
          value={withAccess}
          icon={<Users className="h-4 w-4" style={{ color: '#6366f1' }} />}
          accent="#6366f1"
          sub={`${status.bulkCoveredStudents ?? 0} bulk · ${status.extraCoveredStudents ?? 0} extra`}
        />
        <StatTile
          label="Uncovered"
          value={withoutAccess}
          icon={hasBlockedStudents
            ? <ShieldAlert className="h-4 w-4" style={{ color: '#f87171' }} />
            : <ShieldCheck className="h-4 w-4" style={{ color: '#34d399' }} />}
          accent={hasBlockedStudents ? '#f87171' : '#34d399'}
          sub={hasBlockedStudents ? 'need extra licenses' : 'all active covered'}
        />
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>Capacity usage</span>
          <span>{coveragePercent}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-1.5 rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(coveragePercent, 100)}%`,
              background: hasBlockedStudents ? '#f87171' : '#34d399',
            }}
          />
        </div>
      </div>

      {/* Footer row */}
      <div className="rounded-xl border px-3 py-2 text-xs"
        style={{ borderColor: hasBlockedStudents ? '#f8717130' : 'rgba(255,255,255,0.08)', background: hasBlockedStudents ? '#f8717110' : 'rgba(255,255,255,0.03)' }}>
        <div className="flex items-center justify-between gap-3 text-slate-500">
          <div className="flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5" />
            <span>{(status.requiredAmountPerStudent ?? status.annualPricePerStudent).toLocaleString()} / student/year</span>
          </div>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: onboardingBadge.bg, color: onboardingBadge.color }}
          >
            Onboarding: {onboardingBadge.label}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium" style={{ color: hasBlockedStudents ? '#fecaca' : '#cbd5e1' }}>
          {withoutAccess} student(s) are not covered by the current license. Cost to cover: {(status.extraLicenseCost ?? 0).toLocaleString()}.
        </p>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  icon,
  accent,
  sub,
}: {
  label: string
  value: number
  icon: React.ReactNode
  accent: string
  sub: string
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: `${accent}10`, border: `1px solid ${accent}28` }}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: accent }}>{label}</p>
        {icon}
      </div>
      <p className="text-lg font-extrabold" style={{ color: accent }}>{value.toLocaleString()}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}
