'use client'

import { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, StatCard } from '@/components/ui/Card'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'
import { useLocale } from '@/lib/locale-context'

interface AnalyticsData {
  totalSchools: number
  activeSchools: number
  totalUsers: number
  totalStudents: number
  schoolsByPlan: { plan: string; count: number }[]
  recentSchools: {
    id: string
    name: string
    subscriptionPlan: string
    createdAt: string
  }[]
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession()
  const { locale } = useLocale()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
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
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/schools')
      const schools = res.ok ? await res.json() : []
      
      // Ensure schools is always an array
      const schoolsArray = Array.isArray(schools) ? schools : []
      
      const usersRes = await fetch('/api/users')
      const users = usersRes.ok ? await usersRes.json() : []
      const usersArray = Array.isArray(users) ? users : []
      
      const studentsRes = await fetch('/api/students')
      const students = studentsRes.ok ? await studentsRes.json() : []
      const studentsArray = Array.isArray(students) ? students : []

      const planCounts = schoolsArray.reduce((acc: Record<string, number>, school: { subscriptionPlan: string }) => {
        acc[school.subscriptionPlan] = (acc[school.subscriptionPlan] || 0) + 1
        return acc
      }, {})

      const analyticsData: AnalyticsData = {
        totalSchools: schoolsArray.length,
        activeSchools: schoolsArray.filter((s: { active: boolean }) => s.active).length,
        totalUsers: usersArray.length,
        totalStudents: studentsArray.length,
        schoolsByPlan: Object.entries(planCounts).map(([plan, count]) => ({
          plan,
          count: count as number,
        })),
        recentSchools: schoolsArray
          .sort((a: { createdAt: string }, b: { createdAt: string }) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 5),
      }

      setAnalytics(analyticsData)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

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

  if (status === 'loading' || !session) {
    return <div>{t('common.loading')}</div>
  }

  const navItems = [
    { label: t('navigation.dashboard'), href: '/super-admin/dashboard', icon: '📊' },
    { label: t('navigation.schools'), href: '/super-admin/schools', icon: '🏢' },
    { label: t('navigation.users'), href: '/super-admin/users', icon: '👥' },
    { label: t('navigation.analytics'), href: '/super-admin/analytics', icon: '📈' },
    { label: 'Settings', href: '/super-admin/settings', icon: '⚙️' },
  ]

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
          <h1 className="text-3xl font-bold text-gray-900">{t('school.analytics.title')}</h1>
          <p className="text-gray-600 mt-2">{t('school.analytics.platformOverview')}</p>
        </div>

        {loading ? (
          <div>Loading analytics...</div>
        ) : analytics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Schools"
                value={analytics.totalSchools}
                icon="🏢"
              />
              <StatCard
                title="Active Schools"
                value={analytics.activeSchools}
                icon="✅"
              />
              <StatCard
                title="Total Users"
                value={analytics.totalUsers}
                icon="👥"
              />
              <StatCard
                title="Total Students"
                value={analytics.totalStudents}
                icon="👨‍🎓"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Schools by Subscription Plan</h2>
                <div className="space-y-3">
                  {analytics.schoolsByPlan && analytics.schoolsByPlan.length > 0 ? analytics.schoolsByPlan.map((item) => (
                    <div key={item.plan} className="flex justify-between items-center">
                      <span className="text-gray-700">{item.plan}</span>
                      <span className="font-semibold text-gray-900">{item.count} schools</span>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-center">No data available</p>
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Recently Added Schools</h2>
                <div className="space-y-3">
                  {analytics.recentSchools && analytics.recentSchools.length > 0 ? analytics.recentSchools.map((school) => (
                    <div key={school.id} className="border-b pb-2">
                      <div className="font-medium text-gray-900">{school.name}</div>
                      <div className="text-sm text-gray-600">
                        {school.subscriptionPlan} • {new Date(school.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-center">No recent schools</p>
                  )}
                </div>
              </Card>
            </div>
          </>
        ) : (
          <div>No analytics data available</div>
        )}
      </div>
    </DashboardLayout>
  )
}
