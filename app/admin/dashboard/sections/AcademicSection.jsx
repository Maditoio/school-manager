'use client'

import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from 'recharts'
import { Trophy, TrendingDown, BarChart2 } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'
import { translateDashboardDynamic, translateText } from '@/lib/client-i18n'

function scoreColor(score) {
  if (score >= 70) return '#34d399'
  if (score >= 55) return '#fbbf24'
  return '#ef4444'
}

function CircularProgress({ value }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <svg width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r={radius} fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="6" />
      <circle
        cx="30"
        cy="30"
        r={radius}
        fill="none"
        stroke="#6366f1"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 30 30)"
      />
    </svg>
  )
}

function AcademicSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[122px] animate-pulse rounded-2xl border" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3 h-[320px] animate-pulse rounded-2xl border" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }} />
        <div className="xl:col-span-2 h-[320px] animate-pulse rounded-2xl border" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }} />
      </div>
    </div>
  )
}

export default function AcademicSection({ data, loading }) {
  const { locale } = useLocale()
  if (loading) return <AcademicSkeleton />

  if (!data) {
    return (
      <div className="rounded-2xl border p-6 text-center" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
        <p className="text-sm font-medium text-slate-200">{translateText('No academic data available for the current term yet.', locale)}</p>
        <p className="mt-1 text-xs text-slate-400">{translateText('Results will appear after assessments are graded for this term.', locale)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border p-4" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-medium uppercase text-slate-400">{translateText('Overall Pass Rate', locale)}</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-3xl font-extrabold text-indigo-400">{data.passRate}%</p>
            <CircularProgress value={data.passRate} />
          </div>
        </div>

        <div className="rounded-2xl border p-4" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-medium uppercase text-slate-400">{translateText('Top Performing Class', locale)}</p>
          <p className="mt-2 text-2xl font-bold text-slate-100">{data.topClass.name}</p>
          <p className="mt-1 text-sm text-amber-300">{translateDashboardDynamic(`${data.topClass.average}% avg`, locale)}</p>
          <Trophy className="mt-2 h-4 w-4 text-amber-300" />
        </div>

        <div className="rounded-2xl border p-4" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-medium uppercase text-slate-400">{translateText('Lowest Performing Class', locale)}</p>
          <p className="mt-2 text-2xl font-bold text-slate-100">{data.lowestClass.name}</p>
          <p className="mt-1 text-sm text-rose-400">{translateDashboardDynamic(`${data.lowestClass.average}% avg`, locale)}</p>
          <TrendingDown className="mt-2 h-4 w-4 text-rose-400" />
        </div>

        <div className="rounded-2xl border p-4" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-medium uppercase text-slate-400">{translateText('School Average Mark', locale)}</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-400">{data.schoolAverage.value}%</p>
          <p className="mt-1 text-sm text-emerald-300">{translateDashboardDynamic(data.schoolAverage.delta, locale)}</p>
          <BarChart2 className="mt-2 h-4 w-4 text-emerald-300" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3 rounded-2xl border p-4" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-sm font-semibold text-slate-200">{translateText('Average Mark Per Grade', locale)}</p>
          <div className="mt-3 h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.gradeAverages}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="grade" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: '#161924', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10 }}
                  formatter={(value, _key, ctx) => [translateDashboardDynamic(`${value}% (Pass ${ctx.payload.passRate}%)`, locale), translateText('Average', locale)]}
                />
                <Bar dataKey="average" radius={[8, 8, 0, 0]}>
                  {data.gradeAverages.map((entry) => (
                    <Cell key={entry.grade} fill={scoreColor(entry.average)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-2 rounded-2xl border p-4" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">{translateText('Term Performance Trend', locale)}</p>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" />{translateText('Current', locale)}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" />{translateText('Last', locale)}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-500" />{translateText('Two Terms Ago', locale)}</span>
            </div>
          </div>
          <div className="h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trendByWeek}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="week" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#161924', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10 }} />
                <Line type="monotone" dataKey="current" stroke="#6366f1" strokeWidth={2.8} dot={false} />
                <Line type="monotone" dataKey="last" stroke="#38bdf8" strokeWidth={2} dot={false} strokeDasharray="6 4" />
                <Line type="monotone" dataKey="previous" stroke="#64748b" strokeWidth={1.8} dot={false} strokeDasharray="2 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
