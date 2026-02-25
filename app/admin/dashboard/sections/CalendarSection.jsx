'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function buildCalendarGrid(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const first = new Date(year, month, 1)
  const startDay = first.getDay()
  const start = new Date(year, month, 1 - startDay)

  return Array.from({ length: 42 }).map((_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return day
  })
}

function toISO(d) {
  return d.toISOString().slice(0, 10)
}

function relativeLabel(days) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `in ${days} days`
}

function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <div className="xl:col-span-3 h-[340px] animate-pulse rounded-2xl border" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }} />
      <div className="xl:col-span-2 h-[340px] animate-pulse rounded-2xl border" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }} />
    </div>
  )
}

export default function CalendarSection({ data, loading }) {
  const [monthCursor, setMonthCursor] = useState(() => new Date())
  const [selectedDateISO, setSelectedDateISO] = useState(() => toISO(new Date()))

  const grid = useMemo(() => buildCalendarGrid(monthCursor), [monthCursor])
  const eventByDate = useMemo(() => {
    const map = new Map()
    data.forEach((event) => {
      if (!map.has(event.dateISO)) map.set(event.dateISO, [])
      map.get(event.dateISO).push(event)
    })
    return map
  }, [data])

  const selectedEvents = eventByDate.get(selectedDateISO) || []
  const monthLabel = monthCursor.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })

  if (loading) return <CalendarSkeleton />

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <div className="xl:col-span-3 rounded-2xl border p-4" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
        <p className="mb-3 text-sm font-semibold text-slate-200">Upcoming Events</p>
        <div className="space-y-2">
          {data.map((event) => {
            const dt = new Date(event.dateISO)
            return (
              <div key={event.id} className="flex items-center gap-3 rounded-xl border px-3 py-2" style={{ background: '#161924', borderColor: 'rgba(255,255,255,0.07)' }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: event.color }} />
                <div className="w-[62px] shrink-0 rounded-lg border px-2 py-1 text-center" style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#111420' }}>
                  <p className="text-lg font-extrabold text-slate-100 leading-none">{dt.getDate()}</p>
                  <p className="text-[10px] uppercase text-slate-500">{dt.toLocaleDateString('en-ZA', { month: 'short' })}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{event.title}</p>
                  <span className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${event.color}20`, color: event.color }}>
                    {event.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{relativeLabel(event.daysUntil)}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="xl:col-span-2 rounded-2xl border p-4" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="mb-3 flex items-center justify-between">
          <button className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-slate-200">{monthLabel}</p>
          <button className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((day) => {
            const isCurrentMonth = day.getMonth() === monthCursor.getMonth()
            const iso = toISO(day)
            const hasEvents = eventByDate.has(iso)
            const isToday = iso === toISO(new Date())

            return (
              <button
                key={iso}
                onClick={() => setSelectedDateISO(iso)}
                className="relative h-9 rounded-md text-xs transition"
                style={{
                  background: selectedDateISO === iso ? 'rgba(99,102,241,0.18)' : 'transparent',
                  color: isCurrentMonth ? '#cbd5e1' : '#475569',
                }}
              >
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                  style={isToday ? { background: '#6366f1', color: 'white', fontWeight: 700 } : undefined}
                >
                  {day.getDate()}
                </span>
                {hasEvents ? <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full" style={{ background: '#34d399' }} /> : null}
              </button>
            )
          })}
        </div>

        <div className="mt-3 rounded-xl border p-3" style={{ background: '#161924', borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="text-xs font-semibold text-slate-300">{new Date(selectedDateISO).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          {selectedEvents.length ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              {selectedEvents.map((event) => (
                <li key={event.id} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: event.color }} />
                  <span>{event.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-slate-500">No events on this date.</p>
          )}
        </div>
      </div>
    </div>
  )
}
