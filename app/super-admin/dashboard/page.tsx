import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, StatCard } from '@/components/ui/Card'
import { prisma } from '@/lib/prisma'

async function getDashboardStats() {
  try {
    const schoolsCount = await prisma.school.count()
    const usersCount = await prisma.user.count()
    const studentsCount = await prisma.student.count()
    
    const activeSchools = await prisma.school.count({
      where: { active: true }
    })

    return {
      schoolsCount,
      usersCount,
      studentsCount,
      activeSchools
    }
  } catch {
    return null
  }
}

export default async function SuperAdminDashboard() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    redirect('/login')
  }

  const stats = await getDashboardStats()

  const navItems = [
    { label: 'Dashboard', href: '/super-admin/dashboard', icon: '📊' },
    { label: 'Schools', href: '/super-admin/schools', icon: '🏢' },
    { label: 'Users', href: '/super-admin/users', icon: '👥' },
    { label: 'Analytics', href: '/super-admin/analytics', icon: '📈' },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Super Admin',
        role: 'Super Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage all schools and platform settings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Schools"
            value={stats?.schoolsCount || 0}
            icon="🏢"
          />
          <StatCard
            title="Active Schools"
            value={stats?.activeSchools || 0}
            icon="✅"
          />
          <StatCard
            title="Total Users"
            value={stats?.usersCount || 0}
            icon="👥"
          />
          <StatCard
            title="Total Students"
            value={stats?.studentsCount || 0}
            icon="👨‍🎓"
          />
        </div>

        <Card title="Platform Overview">
          <p className="text-gray-600">Platform statistics and activity will appear here</p>
        </Card>
      </div>
    </DashboardLayout>
  )
}
