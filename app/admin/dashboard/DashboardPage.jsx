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

function sectionLabel(text) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {text}
    </p>
  )
}

export default function DashboardPage({ user }) {
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

  const currentDate = useMemo(
    () =>
      new Date().toLocaleDateString('en-ZA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    []
  )

  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { label: 'Students', href: '/admin/students', icon: '👨‍🎓' },
    { label: 'Teachers', href: '/admin/teachers', icon: '👨‍🏫' },
    { label: 'Classes', href: '/admin/classes', icon: '🏫' },
    { label: 'Subjects', href: '/admin/subjects', icon: '📚' },
    { label: 'Attendance', href: '/admin/attendance', icon: '📅' },
    { label: 'Results', href: '/admin/results', icon: '📝' },
    { label: 'Fees', href: '/admin/fees', icon: '💳' },
    { label: 'Announcements', href: '/admin/announcements', icon: '📢' },
    { label: 'Messages', href: '/admin/messages', icon: '💬' },
    { label: 'Interaction Logs', href: '/admin/interaction-logs', icon: '🕵️' },
  ]

  return (
    <DashboardLayout user={user} navItems={navItems}>
      <div className="min-h-full" style={{ background: '#0b0d14' }}>
        <div className="mx-auto max-w-[1680px] space-y-8 p-2 md:p-4 lg:p-6">
          <header>
            <h1 className="text-3xl font-bold text-slate-100">Good morning, {dashboardData.header.principalName} 👋</h1>
            <p className="mt-2 text-sm text-slate-400">{currentDate} · {dashboardData.header.termLabel}</p>
          </header>

          <section className="space-y-2">
            {sectionLabel('School Pulse')}
            <div className="transition-opacity duration-300" style={{ opacity: loaded.pulse ? 1 : 0.85 }}>
              <SchoolPulseSection data={dashboardData.schoolPulse} loading={!loaded.pulse} />
            </div>
          </section>

          <section className="space-y-2">
            {sectionLabel(dashboardData.financial.periodLabel)}
            <div className="transition-opacity duration-300" style={{ opacity: loaded.financial ? 1 : 0.85 }}>
              <FinancialSection data={dashboardData.financial} loading={!loaded.financial} />
            </div>
          </section>

          <section className="space-y-2">
            {sectionLabel('Academic Performance · Current Term')}
            <div className="transition-opacity duration-300" style={{ opacity: loaded.academic ? 1 : 0.85 }}>
              <AcademicSection data={dashboardData.academic} loading={!loaded.academic} />
            </div>
          </section>

          <section className="space-y-2">
            {sectionLabel('Staff Overview')}
            <div className="transition-opacity duration-300" style={{ opacity: loaded.staff ? 1 : 0.85 }}>
              <StaffSection data={dashboardData.staff} loading={!loaded.staff} />
            </div>
          </section>

          <section className="space-y-2">
            {sectionLabel('Alerts Requiring Attention')}
            <div className="transition-opacity duration-300" style={{ opacity: loaded.alerts ? 1 : 0.85 }}>
              <AlertsSection data={dashboardData.alerts} loading={!loaded.alerts} />
            </div>
          </section>

          <section className="space-y-2">
            {sectionLabel('Upcoming Events')}
            <div className="transition-opacity duration-300" style={{ opacity: loaded.calendar ? 1 : 0.85 }}>
              <CalendarSection data={dashboardData.events} loading={!loaded.calendar} />
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  )
}
