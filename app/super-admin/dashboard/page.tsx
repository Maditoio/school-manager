'use client'

import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, StatCard } from '@/components/ui/Card'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'
import { useLocale } from '@/lib/locale-context'

export default function SuperAdminDashboard() {
  const { data: session, status } = useSession()
  const { locale } = useLocale()
  const [stats, setStats] = useState<{ schoolsCount: number; usersCount: number; studentsCount: number; activeSchools: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SUPER_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/schools')
        const schoolsRes = res.ok ? await res.json() : { schools: [] }
        const schools = Array.isArray(schoolsRes.schools) ? schoolsRes.schools : []
        
        const usersRes = await fetch('/api/users')
        const users = usersRes.ok ? await usersRes.json() : { users: [] }
        const usersList = Array.isArray(users.users) ? users.users : []
        
        const studentsRes = await fetch('/api/students')
        const studentsList = studentsRes.ok ? await studentsRes.json() : { students: [] }
        const students = Array.isArray(studentsList.students) ? studentsList.students : []
        
        const activeSchools = schools.filter((s: { active: boolean }) => s.active).length
        
        setStats({
          schoolsCount: schools.length,
          usersCount: usersList.length,
          studentsCount: students.length,
          activeSchools
        })
      } catch (error) {
        console.error('Failed to fetch stats:', error)
        setStats(null)
      } finally {
        setLoading(false)
      }
    }
    
    if (status === 'authenticated') {
      fetchStats()
    }
  }, [status])

  const preferredLanguage = String(locale || session?.user?.preferredLanguage || 'en').toLowerCase()
  const t = useMemo(() => {
    const messages = preferredLanguage.startsWith('fr')
      ? frMessages
      : preferredLanguage.startsWith('sw')
        ? swMessages
        : enMessages
    return (key: string) => {
      const keys = key.split('.')
      let value: any = messages
      for (const k of keys) {
        value = value?.[k]
      }
      return value || key
    }
  }, [preferredLanguage])

  const navItems = [
    { label: t('navigation.dashboard'), href: '/super-admin/dashboard', icon: '📊' },
    { label: t('navigation.schools'), href: '/super-admin/schools', icon: '🏢' },
    { label: t('navigation.users'), href: '/super-admin/users', icon: '👥' },
    { label: t('navigation.analytics'), href: '/super-admin/analytics', icon: '📈' },
    { label: 'Payments', href: '/super-admin/payments', icon: '💳' },
    { label: 'Settings', href: '/super-admin/settings', icon: '⚙️' },
  ]

  if (!session?.user) {
    return <div>{t('common.loading')}</div>
  }

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || t('roles.super_admin'),
        role: t('roles.super_admin'),
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('admin.dashboard.title')}</h1>
          <p className="text-gray-600 mt-2">{t('admin.dashboard.overview')}</p>
        </div>

        {loading ? (
          <div className="text-center">{t('common.loading')}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title={t('school.analytics.totalSchools')}
                value={stats?.schoolsCount || 0}
                icon="🏢"
              />
              <StatCard
                title={t('school.analytics.activeSchools')}
                value={stats?.activeSchools || 0}
                icon="✅"
              />
              <StatCard
                title={t('school.analytics.totalUsers')}
                value={stats?.usersCount || 0}
                icon="👥"
              />
              <StatCard
                title={t('school.analytics.totalStudents')}
                value={stats?.studentsCount || 0}
                icon="👨‍🎓"
              />
            </div>

            <Card title={t('school.analytics.platformOverview')}>
              <p className="text-gray-600">{t('admin.dashboard.recentActivity')}</p>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
