'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const SUBJECT_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
]

function subjectColor(subjectId: string) {
  let hash = 0
  for (let i = 0; i < subjectId.length; i++) hash = (hash * 31 + subjectId.charCodeAt(i)) & 0xffff
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length]
}

interface TimetableSlot {
  id: string
  classId: string
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
  const d = new Date().getDay() // 0=Sun
  return d === 0 ? 7 : d // map to 1=Mon..7=Sun; Sat=6
})()

export default function TeacherTimetablePage() {
  const { data: session, status } = useSession()
  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'TEACHER') redirect('/login')
  }, [session, status])

  useEffect(() => {
    if (!session) return
    // Fetch current term first, then load slots
    const load = async () => {
      setLoading(true)
      try {
        const termsRes = await fetch('/api/terms')
        const termsData = await termsRes.json()
        const terms: { id: string; isCurrent: boolean }[] = Array.isArray(termsData.terms) ? termsData.terms : []
        const currentTerm = terms.find(t => t.isCurrent)
        const params = new URLSearchParams()
        if (currentTerm) params.set('termId', currentTerm.id)
        const res = await fetch(`/api/timetable?${params}`)
        const data = await res.json()
        setSlots(Array.isArray(data.slots) ? data.slots : [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session])

  if (status === 'loading' || !session) return null

  const activeDays = [...new Set(slots.map(s => s.dayOfWeek))].sort()
  const displayDays = activeDays.length > 0 ? activeDays : [1, 2, 3, 4, 5]
  const uniqueTimes = [...new Set(slots.map(s => s.startTime))].sort()
  const todaySlots = slots.filter(s => s.dayOfWeek === TODAY_DOW).sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Teacher',
        role: 'Teacher',
        email: session.user.email,
      }}
      navItems={TEACHER_NAV_ITEMS}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold ui-text-primary">My Timetable</h1>
          <p className="ui-text-secondary mt-1">Your weekly teaching schedule</p>
        </div>

        {/* Today's schedule */}
        {todaySlots.length > 0 && (
          <div>
            <h2 className="text-base font-semibold ui-text-primary mb-3">Today — {DAYS[TODAY_DOW]}</h2>
            <div className="flex flex-wrap gap-3">
              {todaySlots.map(slot => (
                <Card key={slot.id} className={`p-4 border-l-4 border-l-blue-400 min-w-50`}>
                  <div className="text-[11px] font-mono ui-text-secondary">{slot.startTime}–{slot.endTime}</div>
                  <div className="font-semibold ui-text-primary mt-1">{slot.subject.name}</div>
                  <div className="text-[12px] ui-text-secondary">{slot.class.name}{slot.room ? ` · ${slot.room}` : ''}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Weekly grid */}
        {loading ? (
          <div className="flex items-center gap-2 ui-text-secondary py-8">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent)" />
            Loading timetable…
          </div>
        ) : slots.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="ui-text-secondary">No timetable slots assigned to you yet.</p>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="ui-border border p-2 text-left ui-text-secondary font-medium min-w-20">Time</th>
                  {displayDays.map(d => (
                    <th
                      key={d}
                      className={`ui-border border p-2 text-center font-medium min-w-35 ${
                        d === TODAY_DOW ? 'border-t-2 border-t-blue-400 text-blue-600 dark:text-blue-400' : 'ui-text-secondary'
                      }`}
                    >
                      {DAYS[d]}
                      {d === TODAY_DOW && <span className="ml-1 text-[9px] rounded-full px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Today</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uniqueTimes.map(time => (
                  <tr key={time}>
                    <td className="ui-border border p-2 ui-text-secondary text-[11px] font-mono align-top">{time}</td>
                    {displayDays.map(d => {
                      const cell = slots.find(s => s.dayOfWeek === d && s.startTime === time)
                      return (
                        <td key={d} className={`ui-border border p-1 align-top ${d === TODAY_DOW ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}>
                          {cell ? (
                            <div className={`rounded-md p-2 text-[11px] ${subjectColor(cell.subjectId)}`}>
                              <div className="font-semibold">{cell.subject.name}</div>
                              <div className="opacity-75">{cell.class.name}</div>
                              <div className="opacity-60">{cell.startTime}–{cell.endTime}{cell.room ? ` · ${cell.room}` : ''}</div>
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
        )}
      </div>
    </DashboardLayout>
  )
}
