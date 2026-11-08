import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { TeacherDashboardClient } from '@/components/teacher/TeacherDashboardClient'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'
import { prisma } from '@/lib/prisma'
import { getTeacherAccessibleClassIds } from '@/lib/teacher-class-access'

async function getDashboardData(teacherId: string, schoolId: string) {
  try {
    const classIds = await getTeacherAccessibleClassIds(teacherId, schoolId)

    const [myStudents, mySubjectRows, pendingResults, classes] = await Promise.all([
      classIds.length > 0
        ? prisma.student.count({
            where: { schoolId, classId: { in: classIds } },
          })
        : Promise.resolve(0),
      prisma.$queryRaw<Array<{ subject_id: string }>>`
        SELECT DISTINCT subject_id
        FROM class_subject_teachers
        WHERE school_id = ${schoolId}
          AND teacher_id = ${teacherId}
      `,
      classIds.length > 0
        ? prisma.result.count({
            where: {
              student: { classId: { in: classIds } },
              published: false,
            },
          })
        : Promise.resolve(0),
      classIds.length > 0
        ? prisma.class.findMany({
            where: { id: { in: classIds }, schoolId },
            select: {
              id: true,
              name: true,
              _count: { select: { students: true } },
            },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
    ])

    return {
      stats: {
        myClasses: classIds.length,
        myStudents,
        mySubjects: mySubjectRows.length,
        pendingResults,
      },
      classes: classes.map((cls) => ({
        id: cls.id,
        name: cls.name,
        studentCount: cls._count.students,
      })),
    }
  } catch (error) {
    console.error('Error getting teacher dashboard data:', error)
    return {
      stats: { myClasses: 0, myStudents: 0, mySubjects: 0, pendingResults: 0 },
      classes: [] as Array<{ id: string; name: string; studentCount: number }>,
    }
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

  const data = await getDashboardData(session.user.id, session.user.schoolId)

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Teacher',
        role: 'Teacher',
        email: session.user.email,
      }}
      navItems={TEACHER_NAV_ITEMS}
    >
      <TeacherDashboardClient stats={data.stats} classes={data.classes} />
    </DashboardLayout>
  )
}
