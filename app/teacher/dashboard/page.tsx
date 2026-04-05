import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, StatCard } from '@/components/ui/Card'
import { prisma } from '@/lib/prisma'

async function getDashboardStats(teacherId: string, schoolId: string) {
  try {
    const assignedRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT DISTINCT c.id
      FROM classes c
      LEFT JOIN class_subject_teachers cst ON cst.class_id = c.id
      WHERE c.school_id = ${schoolId}
        AND (
          c.teacher_id = ${teacherId}
          OR cst.teacher_id = ${teacherId}
        )
    `

    const classIds = assignedRows.map((row) => row.id)
    const myClasses = classIds.length

    const myStudents = classIds.length > 0
      ? await prisma.student.count({
          where: {
            schoolId,
            classId: { in: classIds },
          },
        })
      : 0

    const mySubjectRows = await prisma.$queryRaw<Array<{ subject_id: string }>>`
      SELECT DISTINCT subject_id
      FROM class_subject_teachers
      WHERE school_id = ${schoolId}
        AND teacher_id = ${teacherId}
    `

    const mySubjects = mySubjectRows.length

    const pendingResults = classIds.length > 0
      ? await prisma.result.count({
          where: {
            student: {
              classId: { in: classIds },
            },
            published: false,
          },
        })
      : 0

    return {
      myClasses,
      myStudents,
      mySubjects,
      pendingResults
    }
  } catch (error) {
    console.error('Error getting dashboard stats:', error)
    return null
  }
}

export default async function TeacherDashboard() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'TEACHER') {
    redirect('/login')
  }

  if (!session.user.schoolId) {
    redirect('/login')
  }

  const stats = await getDashboardStats(session.user.id, session.user.schoolId)

  const navItems = [
    { label: 'Dashboard', href: '/teacher/dashboard', icon: '📊' },
    { label: 'My Classes', href: '/teacher/classes', icon: '🏫' },
    { label: 'Students', href: '/teacher/students', icon: '👨‍🎓' },
    { label: 'Assessments', href: '/teacher/assessments', icon: '📋' },
    { label: 'Attendance', href: '/teacher/attendance', icon: '📅' },
    { label: 'Off Days', href: '/teacher/off-days', icon: '🛌' },
    { label: 'Results', href: '/teacher/results', icon: '📝' },

    { label: 'Announcements', href: '/teacher/announcements', icon: '📢' },
    { label: 'Messages', href: '/teacher/messages', icon: '💬' },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Teacher',
        role: 'Teacher',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your classes and students</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            title="Assigned Classes"
            value={stats?.myClasses || 0}
            icon="🏫"
          />
          <StatCard
            title="Total Students"
            value={stats?.myStudents || 0}
            icon="👨‍🎓"
          />
          <StatCard
            title="My Subjects"
            value={stats?.mySubjects || 0}
            icon="📚"
          />
          <StatCard
            title="Pending Results"
            value={stats?.pendingResults || 0}
            icon="⏳"
          />
        </div>

        <Card title="Quick Actions">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/teacher/attendance"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="text-2xl mb-2">📅</div>
              <h3 className="font-semibold text-gray-900">Mark Attendance</h3>
              <p className="text-sm text-gray-600 mt-1">Take attendance for your classes</p>
            </a>
            <a
              href="/teacher/results"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="text-2xl mb-2">📝</div>
              <h3 className="font-semibold text-gray-900">Enter Results</h3>
              <p className="text-sm text-gray-600 mt-1">Add test and exam scores</p>
            </a>
            <a
              href="/teacher/off-days"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="text-2xl mb-2">🛌</div>
              <h3 className="font-semibold text-gray-900">Book Off Day</h3>
              <p className="text-sm text-gray-600 mt-1">Submit your leave date range</p>
            </a>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
