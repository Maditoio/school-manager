'use client'

import { useMemo, useState } from 'react'
import { ClipboardList, BookOpen, FileWarning, X } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'
import { translateDashboardDynamic, translateText } from '@/lib/client-i18n'

const toneMap = {
  warning: { bg: 'rgba(251,191,36,0.06)', border: '#fbbf24', icon: '#fbbf24' },
  danger: { bg: 'rgba(239,68,68,0.06)', border: '#ef4444', icon: '#ef4444' },
  info: { bg: 'rgba(56,189,248,0.06)', border: '#38bdf8', icon: '#38bdf8' },
}

const iconMap = {
  'Pending Results': ClipboardList,
  'Unassigned Subjects': BookOpen,
  'Contract Expiring': FileWarning,
}

function StaffSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <div className="xl:col-span-3 h-[340px] animate-pulse rounded-2xl border" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }} />
      <div className="xl:col-span-2 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[98px] animate-pulse rounded-xl border" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }} />
        ))}
      </div>
    </div>
  )
}

export default function StaffSection({ data, loading }) {
  const { locale } = useLocale()
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)
  const [attendance, setAttendance] = useState(() => Object.fromEntries(data.teachers.map((t) => [t.id, t.status])))

  const openAction = (href) => {
    if (href) {
      window.open(href, '_self')
    }
  }

  const unattendedClasses = useMemo(() => {
    return data.teachers
      .filter((teacher) => attendance[teacher.id] === 'Absent')
      .map((teacher) => `${teacher.subject} classes unattended`)
  }, [data.teachers, attendance])

  const visibleTeachers = useMemo(() => data.teachers.slice(0, 5), [data.teachers])
  const hiddenTeachersCount = Math.max(0, data.teachers.length - visibleTeachers.length)

  if (loading) return <StaffSkeleton />

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3 rounded-2xl border p-4" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">{translateText('Teacher Status Today', locale)}</p>
            <button
              className="h-8 rounded-[10px] border px-3 text-xs font-semibold text-slate-300 transition hover:text-white"
              style={{ background: '#161924', borderColor: 'rgba(255,255,255,0.08)', opacity: 0.5, cursor: 'not-allowed' }}
              disabled
              aria-disabled="true"
              title="Temporarily unavailable"
              onClick={() => {}}
            >
              {translateText('Mark Attendance', locale)}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <table className="min-w-full">
              <thead style={{ background: '#161924' }}>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-medium">{translateText('Teacher', locale)}</th>
                  <th className="px-3 py-2 font-medium">{translateText('Subject', locale)}</th>
                  <th className="px-3 py-2 font-medium">{translateText('Today', locale)}</th>
                </tr>
              </thead>
              <tbody>
                {visibleTeachers.map((teacher) => {
                  const absent = attendance[teacher.id] === 'Absent'
                  return (
                    <tr
                      key={teacher.id}
                      className="border-t"
                      style={{
                        borderColor: 'rgba(255,255,255,0.06)',
                        background: absent ? 'rgba(239,68,68,0.04)' : '#111420',
                        borderLeft: absent ? '3px solid #ef4444' : undefined,
                      }}
                    >
                      <td className="px-3 py-2 text-sm text-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-[11px] font-semibold text-slate-200">
                            {teacher.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                          </span>
                          <a href={`/admin/teachers/${teacher.id}`} className="hover:text-indigo-300 transition-colors">
                            {teacher.name}
                          </a>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-300">{teacher.subject}</td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex rounded-full px-2 py-1 text-[11px] font-semibold"
                          style={attendance[teacher.id] === 'Present'
                            ? { background: 'rgba(52,211,153,0.12)', color: '#34d399' }
                            : { background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                        >
                          {translateText(attendance[teacher.id], locale)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {hiddenTeachersCount > 0 ? (
            <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
              <p>{translateDashboardDynamic(`${hiddenTeachersCount} more teachers not shown.`, locale)}</p>
              <a href="/admin/teachers" className="font-semibold text-indigo-400 hover:text-indigo-300">{translateText('View the rest →', locale)}</a>
            </div>
          ) : null}

          <a href="/admin/teachers" className="mt-3 inline-block text-sm font-semibold text-indigo-400 hover:text-indigo-300">{translateDashboardDynamic(`View all ${data.teachers.length} teachers →`, locale)}</a>
        </div>

        <div className="xl:col-span-2 space-y-3">
          {data.alertCards.map((card) => {
            const Icon = iconMap[card.title] || ClipboardList
            const tone = toneMap[card.tone]
            return (
              <div
                key={card.id}
                className="rounded-xl border px-4 py-3 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: tone.bg,
                  borderColor: 'rgba(255,255,255,0.08)',
                  borderLeft: `3px solid ${tone.border}`,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4" style={{ color: tone.icon }} />
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{translateText(card.title, locale)}</p>
                      <p className="text-xs text-slate-400">{translateDashboardDynamic(card.text, locale)}</p>
                    </div>
                  </div>
                  <button
                    className="rounded-lg border px-2 py-1 text-[11px] font-semibold text-slate-300 hover:text-slate-100"
                    style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
                    onClick={() => openAction(card.actionHref)}
                  >
                    {translateText(card.action, locale)}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showAttendanceModal ? (
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border p-5" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.1)' }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100">{translateText('Mark Teacher Attendance', locale)}</h3>
              <button className="text-slate-400 hover:text-slate-200" onClick={() => setShowAttendanceModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[55vh] space-y-2 overflow-auto">
              {data.teachers.map((teacher) => (
                <div key={teacher.id} className="flex items-center justify-between rounded-xl border p-3" style={{ background: '#161924', borderColor: 'rgba(255,255,255,0.07)' }}>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{teacher.name}</p>
                    <p className="text-xs text-slate-400">{teacher.subject}</p>
                  </div>
                  <div className="inline-flex rounded-lg border p-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    {['Present', 'Absent'].map((status) => (
                      <button
                        key={status}
                        className="rounded-md px-3 py-1.5 text-xs font-semibold"
                        style={attendance[teacher.id] === status
                          ? status === 'Present'
                            ? { background: 'rgba(52,211,153,0.18)', color: '#34d399' }
                            : { background: 'rgba(239,68,68,0.18)', color: '#ef4444' }
                          : { color: '#94a3b8' }}
                        onClick={() => setAttendance((prev) => ({ ...prev, [teacher.id]: status }))}
                      >
                        {translateText(status, locale)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {unattendedClasses.length > 0 ? (
              <div className="mt-4 rounded-xl border p-3 text-sm" style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.3)', color: '#fbbf24' }}>
                <p className="font-semibold">{translateText('Unattended classes', locale)}</p>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {unattendedClasses.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button
                className="h-9 rounded-[10px] px-4 text-sm font-semibold text-white"
                style={{ background: '#6366f1' }}
                onClick={() => setShowAttendanceModal(false)}
              >
                {translateText('Save Attendance', locale)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
