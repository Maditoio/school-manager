'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'
import { useStudentUi } from '@/lib/use-student-ui'

const DAYS_EN = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_FR = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const DAYS_SW = ['', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi']

const SUBJECT_COLORS = [
  'bg-[#f0effe] text-[#5146e8]',
  'bg-[#eafaf3] text-[#1b8a5a]',
  'bg-[#fff8e6] text-[#b07d00]',
  'bg-[#fff0ee] text-[#c0392b]',
  'bg-(--surface-soft) ui-text-primary',
]

function subjectColor(subjectId: string) {
  let hash = 0
  for (let i = 0; i < subjectId.length; i++) hash = (hash * 31 + subjectId.charCodeAt(i)) & 0xffff
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length]
}

interface TimetableSlot {
  id: string
  subjectId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  room: string | null
  class: { name: string }
  subject: { name: string; code: string | null }
  teacher: { firstName: string | null; lastName: string | null }
}

const TODAY_DOW = (() => {
  const d = new Date().getDay()
  return d === 0 ? 7 : d
})()

export default function StudentTimetablePage() {
  const { data: session, status } = useSession()
  const { locale, tStudent } = useStudentUi()
  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [mobileDay, setMobileDay] = useState(TODAY_DOW <= 6 ? TODAY_DOW : 1)

  const DAYS = locale === 'fr' ? DAYS_FR : locale === 'sw' ? DAYS_SW : DAYS_EN

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'STUDENT') redirect('/login')
  }, [session, status])

  useEffect(() => {
    if (!session) return
    setLoading(true)
    fetch('/api/timetable')
      .then((r) => r.json())
      .then((data) => setSlots(Array.isArray(data.slots) ? data.slots : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  if (status === 'loading' || !session) return null

  const activeDays = [...new Set(slots.map((s) => s.dayOfWeek))].sort()
  const displayDays = activeDays.length > 0 ? activeDays : [1, 2, 3, 4, 5]
  const uniqueTimes = [...new Set(slots.map((s) => s.startTime))].sort()
  const todaySlots = slots
    .filter((s) => s.dayOfWeek === TODAY_DOW)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const mobileDaySlots = slots
    .filter((s) => s.dayOfWeek === mobileDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const classCountLabel =
    todaySlots.length === 1
      ? tStudent('classSingular', '{count} class', { count: todaySlots.length })
      : tStudent('classesCount', '{count} classes', { count: todaySlots.length })

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Student',
        role: 'Student',
        email: session.user.email,
      }}
      navItems={STUDENT_NAV_ITEMS}
    >
      <div className="space-y-5">
        <div>
          <h1 className="text-[20px] font-semibold ui-text-primary">
            {tStudent('timetableTitle', 'My Class Schedule')}
          </h1>
          <p className="mt-1 text-sm ui-text-secondary">
            {tStudent('timetableSubtitle', 'Your weekly timetable')}
          </p>
        </div>

        {todaySlots.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold ui-text-primary">
              {tStudent('today', 'Today')} — {DAYS[TODAY_DOW]}
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: '#f0effe', color: '#5146e8' }}
              >
                {classCountLabel}
              </span>
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {todaySlots.map((slot) => (
                <Card
                  key={slot.id}
                  className="min-w-[180px] shrink-0 border-l-[3px] border-l-[#635bff] p-4"
                >
                  <div className="font-mono text-[11px] ui-text-secondary">
                    {slot.startTime}–{slot.endTime}
                  </div>
                  <div className="mt-1 font-semibold ui-text-primary">{slot.subject.name}</div>
                  <div className="text-[12px] ui-text-secondary">
                    {slot.teacher.firstName} {slot.teacher.lastName}
                    {slot.room ? ` · ${slot.room}` : ''}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-8 ui-text-secondary">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent)" />
            {tStudent('loadingSchedule', 'Loading schedule…')}
          </div>
        ) : slots.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="ui-text-secondary">
              {tStudent('noTimetable', 'No timetable has been set for your class yet.')}
            </p>
          </Card>
        ) : (
          <>
            {/* Mobile: day chips + list */}
            <div className="space-y-3 md:hidden">
              <p className="text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
                {tStudent('weeklySchedule', 'Weekly schedule')}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {displayDays.map((d) => {
                  const active = mobileDay === d
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setMobileDay(d)}
                      className={`min-h-11 shrink-0 rounded-[6px] px-3 text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
                        active
                          ? 'text-white'
                          : 'border border-(--border-subtle) bg-(--surface-card) ui-text-secondary'
                      }`}
                      style={active ? { background: '#635bff' } : undefined}
                    >
                      {DAYS[d]?.slice(0, 3)}
                      {d === TODAY_DOW ? ` · ${tStudent('today', 'Today')}` : ''}
                    </button>
                  )
                })}
              </div>
              {mobileDaySlots.length === 0 ? (
                <Card className="p-6 text-center ui-text-secondary">—</Card>
              ) : (
                <div className="space-y-2">
                  {mobileDaySlots.map((slot) => (
                    <Card key={slot.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold ui-text-primary">{slot.subject.name}</p>
                          <p className="mt-0.5 text-xs ui-text-secondary">
                            {slot.teacher.firstName} {slot.teacher.lastName}
                            {slot.room ? ` · ${slot.room}` : ''}
                          </p>
                        </div>
                        <p className="shrink-0 font-mono text-[12px] font-medium ui-text-primary">
                          {slot.startTime}–{slot.endTime}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop grid */}
            <div className="hidden overflow-hidden rounded-[10px] border border-(--border-subtle) md:block">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-(--surface-soft)">
                      <th className="min-w-20 border border-(--border-subtle) bg-(--surface-soft) p-2 text-left text-[11px] font-medium uppercase tracking-[0.07em] ui-text-secondary">
                        {tStudent('time', 'Time')}
                      </th>
                      {displayDays.map((d) => (
                        <th
                          key={d}
                          className={`min-w-35 border border-(--border-subtle) bg-(--surface-soft) p-2 text-center font-medium ${
                            d === TODAY_DOW ? 'text-[#5146e8]' : 'ui-text-secondary'
                          }`}
                          style={d === TODAY_DOW ? { borderTop: '2px solid #635bff' } : undefined}
                        >
                          {DAYS[d]}
                          {d === TODAY_DOW && (
                            <span
                              className="ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                              style={{ background: '#f0effe', color: '#5146e8' }}
                            >
                              {tStudent('today', 'Today')}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueTimes.map((time) => (
                      <tr key={time}>
                        <td className="border border-(--border-subtle) bg-(--surface-soft) p-2 align-top font-mono text-[11px] ui-text-secondary">
                          {time}
                        </td>
                        {displayDays.map((d) => {
                          const cell = slots.find((s) => s.dayOfWeek === d && s.startTime === time)
                          return (
                            <td
                              key={d}
                              className="border border-(--border-subtle) p-1 align-top"
                              style={
                                d === TODAY_DOW ? { background: 'color-mix(in srgb, #635bff 6%, white)' } : undefined
                              }
                            >
                              {cell ? (
                                <div className={`rounded-[6px] p-2 text-[11px] ${subjectColor(cell.subjectId)}`}>
                                  <div className="font-semibold">{cell.subject.name}</div>
                                  <div className="opacity-75">
                                    {cell.teacher.firstName} {cell.teacher.lastName}
                                  </div>
                                  <div className="opacity-60">
                                    {cell.startTime}–{cell.endTime}
                                    {cell.room ? ` · ${cell.room}` : ''}
                                  </div>
                                </div>
                              ) : null}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
