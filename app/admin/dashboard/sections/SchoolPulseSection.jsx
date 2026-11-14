'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts'
import { Users, UserPlus, UserX, AlertCircle, TrendingDown, GraduationCap, BookOpen } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'
import { translateDashboardDynamic, translateText } from '@/lib/client-i18n'

const iconMap = {
  'Total Students': Users,
  'New This Term': UserPlus,
  'Absent Today': UserX,
  'Fee Defaulters': AlertCircle,
  'Below Pass Mark': TrendingDown,
  'Total Teachers': GraduationCap,
  'Teachers Absent': UserX,
  'Unassigned Subjects': BookOpen,
}

function PulseCard({ item, onClick, locale }) {
  const Icon = iconMap[item.label] || Users
  const sparklineData = useMemo(() => {
    const series =
      Array.isArray(item.sparkline) && item.sparkline.length > 0
        ? item.sparkline
        : [Number(item.value) || 0]
    return series.map((value, i) => ({ x: i, y: Number(value) || 0 }))
  }, [item.sparkline, item.value])
  const absentThresholdExceeded = item.label === 'Absent Today' && item.value > 62 // >5% of 1245
  const unassignedAttention = item.label === 'Unassigned Subjects' && item.value > 0

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className="group rounded-2xl border p-4 transition-all duration-200"
      style={{
        background: 'var(--dash-surface)',
        borderColor: 'var(--dash-border)',
        transform: 'translateY(0)',
        boxShadow: absentThresholdExceeded ? '0 0 0 1px rgba(239,68,68,0.25), 0 0 24px rgba(239,68,68,0.14)' : 'var(--dash-shadow)',
        animation: absentThresholdExceeded ? 'pulseGlow 2.2s ease-in-out infinite' : undefined,
        borderLeft: unassignedAttention ? '3px solid #ef4444' : '1px solid var(--dash-border)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-slate-400">{translateText(item.label, locale)}</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight text-slate-100">
            {Number(item?.value ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-[12px] text-slate-500">
            {translateDashboardDynamic(item?.trendLabel || '', locale)}
          </p>
        </div>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: `${item.accent}1A`, border: `1px solid ${item.accent}40` }}
        >
          <Icon className="h-5 w-5" style={{ color: item.accent }} />
        </div>
      </div>

      <div className="mt-4 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparklineData}>
            <Tooltip
              contentStyle={{
                background: 'var(--dash-tooltip-bg)',
                border: '1px solid var(--dash-tooltip-border)',
                borderRadius: 10,
                color: 'var(--dash-tooltip-color)',
              }}
              labelStyle={{ display: 'none' }}
            />
            <Line type="monotone" dataKey="y" stroke={item.accent} strokeWidth={2.2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <style jsx>{`
        .group:hover {
          transform: translateY(-2px);
          box-shadow: var(--dash-shadow);
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(239,68,68,0.20), 0 0 18px rgba(239,68,68,0.12); }
          50% { box-shadow: 0 0 0 1px rgba(239,68,68,0.35), 0 0 30px rgba(239,68,68,0.22); }
        }
      `}</style>
    </div>
  )
}

function SchoolPulseSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, idx) => (
        <div key={idx} className="h-[190px] animate-pulse rounded-2xl border" style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }} />
      ))}
    </div>
  )
}

export default function SchoolPulseSection({ data, loading, cardLinks = {} }) {
  const router = useRouter()
  const { locale } = useLocale()
  const items = [
    data.totalStudents,
    data.newThisTerm,
    data.absentToday,
    data.feeDefaulters,
    data.belowPassMark,
    data.totalTeachers,
    data.teachersAbsent,
    data.unassignedSubjects,
  ]

  if (loading) return <SchoolPulseSkeleton />

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {items.map((item, index) => (
        <PulseCard
          key={`${item.label}-${index}`}
          item={item}
          locale={locale}
          onClick={cardLinks[item.label] ? () => router.push(cardLinks[item.label]) : undefined}
        />
      ))}
    </div>
  )
}
