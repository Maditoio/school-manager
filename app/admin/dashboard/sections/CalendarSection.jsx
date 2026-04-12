'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'
import { translateText } from '@/lib/client-i18n'

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

function enumerateEventDates(event) {
  const startISO = event.startDateISO || event.dateISO
  const endISO = event.endDateISO || event.dateISO
  const dates = []
  const cursor = new Date(startISO)
  const end = new Date(endISO)

  cursor.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  while (cursor.getTime() <= end.getTime()) {
    dates.push(toISO(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function relativeLabel(days, locale) {
  if (days === 0) return translateText('Today', locale)
  if (days === 1) return translateText('Tomorrow', locale)
  if (locale === 'fr') return `dans ${days} jours`
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
  const { locale } = useLocale()
  const [monthCursor, setMonthCursor] = useState(() => new Date())
  const [selectedDateISO, setSelectedDateISO] = useState(() => toISO(new Date()))

  const grid = useMemo(() => buildCalendarGrid(monthCursor), [monthCursor])
  const eventByDate = useMemo(() => {
    const map = new Map()
    data.forEach((event) => {
      enumerateEventDates(event).forEach((dateISO) => {
        if (!map.has(dateISO)) map.set(dateISO, [])
        map.get(dateISO).push(event)
      })
    })
    return map
  }, [data])

  const selectedEvents = eventByDate.get(selectedDateISO) || []
  const monthLabel = monthCursor.toLocaleDateString(locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-KE' : 'en-ZA', { month: 'long', year: 'numeric' })

  if (loading) return <CalendarSkeleton />

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <div className="xl:col-span-3 rounded-2xl border p-4" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
        <p className="mb-3 text-sm font-semibold text-slate-200">{translateText('Upcoming Events', locale)}</p>
        {data.length ? (
          <div className="space-y-2">
            {data.map((event) => {
              const dt = new Date(event.startDateISO || event.dateISO)
              const hasRange = Boolean(event.endDateISO && event.endDateISO !== (event.startDateISO || event.dateISO))
              return (
                <div key={event.id} className="flex items-center gap-3 rounded-xl border px-3 py-2" style={{ background: '#161924', borderColor: 'rgba(255,255,255,0.07)' }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: event.color }} />
                  <div className="w-[62px] shrink-0 rounded-lg border px-2 py-1 text-center" style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#111420' }}>
                    <p className="text-lg font-extrabold text-slate-100 leading-none">{dt.getDate()}</p>
                    <p className="text-[10px] uppercase text-slate-500">{dt.toLocaleDateString(locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-KE' : 'en-ZA', { month: 'short' })}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100">{event.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${event.color}20`, color: event.color }}>
                        {translateText(event.category, locale)}
                      </span>
                      {hasRange ? (
                        <span className="text-[11px] text-slate-500">
                          {new Date(event.startDateISO).toLocaleDateString(locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-KE' : 'en-ZA', { month: 'short', day: 'numeric' })}
                          {' - '}
                          {new Date(event.endDateISO).toLocaleDateString(locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-KE' : 'en-ZA', { month: 'short', day: 'numeric' })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">{relativeLabel(event.daysUntil, locale)}</p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border px-4 py-6 text-center" style={{ background: '#161924', borderColor: 'rgba(255,255,255,0.07)' }}>
            <p className="text-sm text-slate-400">{translateText('No announcements scheduled.', locale)}</p>
          </div>
        )}
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
          {(locale === 'fr' ? ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).map((d) => <div key={d}>{d}</div>)}
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
          <p className="text-xs font-semibold text-slate-300">{new Date(selectedDateISO).toLocaleDateString(locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-KE' : 'en-ZA', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          {selectedEvents.length ? (
            <div className="mt-2 space-y-3">
              {selectedEvents.map((event) => (
                <div key={`${event.id}-${selectedDateISO}`} className="rounded-lg border p-3" style={{ background: '#111420', borderColor: 'rgba(255,255,255,0.07)' }}>
                  {event.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={event.imageUrl} alt={event.title} className="mb-3 h-28 w-full rounded-lg object-cover" />
                  ) : null}
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: event.color }} />
                    <p className="text-sm font-semibold text-slate-100">{event.title}</p>
                  </div>
                  {event.description ? <p className="mt-2 text-xs leading-relaxed text-slate-400">{event.description}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">{translateText('No events on this date.', locale)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
