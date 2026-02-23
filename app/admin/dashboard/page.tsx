import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, StatCard } from '@/components/ui/Card'
import { prisma } from '@/lib/prisma'
import { calculateAttendancePercentage } from '@/lib/utils'

async function getDashboardStats(schoolId: string) {
  try {
    const studentsCount = await prisma.student.count({ where: { schoolId } })
    const teachersCount = await prisma.user.count({ 
      where: { schoolId, role: 'TEACHER' } 
    })
    const classesCount = await prisma.class.count({ where: { schoolId } })
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayAttendance = await prisma.attendance.findMany({
      where: {
        student: { schoolId },
        date: { gte: today }
      }
    })
    
    const presentCount = todayAttendance.filter(a => a.status === 'PRESENT').length
    const attendanceRate = calculateAttendancePercentage(presentCount, todayAttendance.length)

    return {
      studentsCount,
      teachersCount,
      classesCount,
      attendanceRate
    }
  } catch {
    return null
  }
}

export default async function AdminDashboard() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'SCHOOL_ADMIN') {
    redirect('/login')
  }

  if (!session.user.schoolId) {
    redirect('/login')
  }

  const stats = await getDashboardStats(session.user.schoolId)

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
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">School Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your school effectively</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Students"
            value={stats?.studentsCount || 0}
            icon="👨‍🎓"
          />
          <StatCard
            title="Total Teachers"
            value={stats?.teachersCount || 0}
            icon="👨‍🏫"
          />
          <StatCard
            title="Total Classes"
            value={stats?.classesCount || 0}
            icon="🏫"
          />
          <StatCard
            title="Attendance Rate"
            value={`${stats?.attendanceRate || 0}%`}
            icon="📅"
          />
        </div>

        <Card title="Recent Activity">
          <p className="text-gray-600">Activity feed will appear here</p>
        </Card>
      </div>
    </DashboardLayout>
  )
}
