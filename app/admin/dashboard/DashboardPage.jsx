'use client'

import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import SchoolPulseSection from './sections/SchoolPulseSection'
import FinancialSection from './sections/FinancialSection'
import AcademicSection from './sections/AcademicSection'
import StaffSection from './sections/StaffSection'
import AlertsSection from './sections/AlertsSection'
import CalendarSection from './sections/CalendarSection'
import { dashboardData } from './dashboardData'
import { useLocale } from '@/lib/locale-context'
import { translateDashboardDynamic, translateText } from '@/lib/client-i18n'
import { ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

function sectionLabel(text) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {text}
    </p>
  )
}

export default function DashboardPage({ user }) {
  const { locale } = useLocale()
  const [dashboardState, setDashboardState] = useState({
    ...dashboardData,
    academic: null,
    alerts: [],
    staff: dashboardData.staff,
  })
  const [headerTermLabel, setHeaderTermLabel] = useState(dashboardData.header.termLabel)
  const [academicLoaded, setAcademicLoaded] = useState(false)
  const [statsLoaded, setStatsLoaded] = useState(false)
  const [loaded, setLoaded] = useState({
    pulse: false,
    financial: false,
    academic: false,
    staff: false,
    alerts: false,
    calendar: false,
  })

  useEffect(() => {
    const timers = [
      setTimeout(() => setLoaded((prev) => ({ ...prev, pulse: true })), 250),
      setTimeout(() => setLoaded((prev) => ({ ...prev, financial: true })), 620),
      setTimeout(() => setLoaded((prev) => ({ ...prev, academic: true })), 950),
      setTimeout(() => setLoaded((prev) => ({ ...prev, staff: true })), 1200),
      setTimeout(() => setLoaded((prev) => ({ ...prev, alerts: true })), 1400),
      setTimeout(() => setLoaded((prev) => ({ ...prev, calendar: true })), 1550),
    ]

    return () => timers.forEach((timer) => clearTimeout(timer))
  }, [])

  useEffect(() => {
    let active = true

    const loadStats = async () => {
      try {
        const response = await fetch('/api/dashboard/stats?refresh=1', { cache: 'no-store' })
        if (!response.ok) {
          setAcademicLoaded(true)
          setStatsLoaded(true)
          return
        }

        const stats = await response.json()
        if (!active) return

        setDashboardState((prev) => ({
          ...prev,
          schoolPulse: {
            ...prev.schoolPulse,
            totalStudents: {
              ...prev.schoolPulse.totalStudents,
              value: Number.isFinite(Number(stats.studentsCount))
                ? Number(stats.studentsCount)
                : prev.schoolPulse.totalStudents.value,
            },
            newThisTerm: {
              ...prev.schoolPulse.newThisTerm,
              value: Number.isFinite(Number(stats.newThisTermCount))
                ? Number(stats.newThisTermCount)
                : prev.schoolPulse.newThisTerm.value,
            },
            totalTeachers: {
              ...prev.schoolPulse.totalTeachers,
              value: Number.isFinite(Number(stats.teachersCount))
                ? Number(stats.teachersCount)
                : prev.schoolPulse.totalTeachers.value,
            },
            teachersAbsent: {
              ...prev.schoolPulse.teachersAbsent,
              value: Number.isFinite(Number(stats.teachersAbsentCount))
                ? Number(stats.teachersAbsentCount)
                : prev.schoolPulse.teachersAbsent.value,
            },
            absentToday: {
              ...prev.schoolPulse.absentToday,
              value: Number.isFinite(Number(stats.absentTodayCount))
                ? Number(stats.absentTodayCount)
                : prev.schoolPulse.absentToday.value,
            },
            feeDefaulters: {
              ...prev.schoolPulse.feeDefaulters,
              value: Number.isFinite(Number(stats.feeDefaultersCount))
                ? Number(stats.feeDefaultersCount)
                : prev.schoolPulse.feeDefaulters.value,
            },
          },
          financial: stats.financial
            ? {
                ...prev.financial,
                ...stats.financial,
                totalCollected: {
                  ...prev.financial.totalCollected,
                  ...(stats.financial.totalCollected || {}),
                },
                outstandingBalance: {
                  ...prev.financial.outstandingBalance,
                  ...(stats.financial.outstandingBalance || {}),
                },
                collectedToday: {
                  ...prev.financial.collectedToday,
                  ...(stats.financial.collectedToday || {}),
                },
                termTarget: {
                  ...prev.financial.termTarget,
                  ...(stats.financial.termTarget || {}),
                },
                paymentMethods: Array.isArray(stats.financial.paymentMethods)
                  ? stats.financial.paymentMethods
                  : prev.financial.paymentMethods,
              }
            : prev.financial,
          academic: stats.academic
            ? {
                ...stats.academic,
                gradeAverages: Array.isArray(stats.academic.gradeAverages)
                  ? stats.academic.gradeAverages
                  : [],
                trendByWeek: Array.isArray(stats.academic.trendByWeek)
                  ? stats.academic.trendByWeek
                  : [],
              }
            : null,
          alerts: Array.isArray(stats.alerts) ? stats.alerts : [],
          staff: stats.staff
            ? {
                ...stats.staff,
                teachers: Array.isArray(stats.staff.teachers) ? stats.staff.teachers : [],
                alertCards: Array.isArray(stats.staff.alertCards) ? stats.staff.alertCards : [],
              }
            : prev.staff,
        }))
        setAcademicLoaded(true)
        setStatsLoaded(true)
      } catch (error) {
        console.error('Failed to load dashboard stats:', error)
        if (active) {
          setAcademicLoaded(true)
          setStatsLoaded(true)
        }
      }
    }

    loadStats()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadCurrentTermLabel = async () => {
      try {
        const response = await fetch('/api/terms', { cache: 'no-store' })
        if (!response.ok) return

        const payload = await response.json()
        const currentTerm = payload?.currentTerm
        if (!active || !currentTerm?.startDate || !currentTerm?.endDate || !currentTerm?.name) return

        const start = new Date(currentTerm.startDate)
        const end = new Date(currentTerm.endDate)
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return

        const startOfTermUtc = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
        const endOfTermUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
        const today = new Date()
        const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

        const msPerDay = 24 * 60 * 60 * 1000
        const totalDays = Math.max(1, Math.floor((endOfTermUtc.getTime() - startOfTermUtc.getTime()) / msPerDay) + 1)
        const totalWeeks = Math.max(1, Math.ceil(totalDays / 7))

        const elapsedDays = Math.floor((todayUtc.getTime() - startOfTermUtc.getTime()) / msPerDay) + 1
        const rawWeek = elapsedDays <= 0 ? 1 : Math.ceil(elapsedDays / 7)
        const currentWeek = Math.min(totalWeeks, Math.max(1, rawWeek))

        setHeaderTermLabel(`${currentTerm.name} · Week ${currentWeek} of ${totalWeeks}`)
      } catch (error) {
        console.error('Failed to load current term label:', error)
      }
    }

    loadCurrentTermLabel()

    return () => {
      active = false
    }
  }, [])

  const currentDate = useMemo(
    () =>
      new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-KE' : 'en-ZA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [locale]
  )

  const localizedTermLabel = useMemo(() => {
    if (locale === 'en') return headerTermLabel

    return headerTermLabel
      .replace('Term', translateText('Term', locale))
      .replace('Week', translateText('Week', locale))
      .replace(' of ', ` ${translateText('of', locale)} `)
  }, [headerTermLabel, locale])

  const greetingName = typeof user?.name === 'string' && user.name.trim()
    ? user.name.trim()
    : dashboardData.header.principalName

  const navItems = ADMIN_NAV_ITEMS

  return (
    <DashboardLayout user={user} navItems={navItems}>
      <div className="min-h-full" style={{ background: '#0b0d14' }}>
        <div className="mx-auto max-w-[1680px] space-y-8 p-2 md:p-4 lg:p-6">
          <header>
            <h1 className="text-3xl font-bold text-slate-100">{translateText('Good morning', locale)}, {greetingName} 👋</h1>
            <p className="mt-2 text-sm text-slate-400">{currentDate} · {localizedTermLabel}</p>
          </header>

          <section className="space-y-2">
            {sectionLabel(translateText('School Pulse', locale))}
            <div className="transition-opacity duration-300" style={{ opacity: loaded.pulse ? 1 : 0.85 }}>
              <SchoolPulseSection
                data={dashboardState.schoolPulse}
                loading={!loaded.pulse}
                cardLinks={{
                  'Teachers Absent': '/admin/teachers-absent',
                }}
              />
            </div>
          </section>

          <section className="space-y-2">
            {sectionLabel(translateDashboardDynamic(dashboardState.financial.periodLabel, locale))}
            <div className="transition-opacity duration-300" style={{ opacity: loaded.financial ? 1 : 0.85 }}>
              <FinancialSection data={dashboardState.financial} loading={!loaded.financial} />
            </div>
          </section>

          <section className="space-y-2">
            {sectionLabel(translateText('Academic Performance · Current Term', locale))}
            <div className="transition-opacity duration-300" style={{ opacity: loaded.academic ? 1 : 0.85 }}>
              <AcademicSection data={dashboardState.academic} loading={!academicLoaded} />
            </div>
          </section>

          <section className="space-y-2">
            {sectionLabel(translateText('Staff Overview', locale))}
            <div className="transition-opacity duration-300" style={{ opacity: loaded.staff ? 1 : 0.85 }}>
              <StaffSection data={dashboardState.staff} loading={!loaded.staff} />
            </div>
          </section>

          <section className="space-y-2">
            {sectionLabel(translateText('Alerts Requiring Attention', locale))}
            <div className="transition-opacity duration-300" style={{ opacity: loaded.alerts ? 1 : 0.85 }}>
              <AlertsSection data={dashboardState.alerts || []} loading={!statsLoaded} />
            </div>
          </section>

          <section className="space-y-2">
            {sectionLabel(translateText('Upcoming Events', locale))}
            <div className="transition-opacity duration-300" style={{ opacity: loaded.calendar ? 1 : 0.85 }}>
              <CalendarSection data={dashboardData.events} loading={!loaded.calendar} />
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  )
}
