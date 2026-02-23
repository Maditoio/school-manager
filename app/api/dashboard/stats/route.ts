import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateAttendancePercentage } from "@/lib/utils"

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schoolId = session.user.schoolId

    if (session.user.role === 'SUPER_ADMIN') {
      // Super Admin stats
      const schoolsCount = await prisma.school.count()
      const activeSchools = await prisma.school.count({
        where: { active: true },
      })
      const totalUsers = await prisma.user.count()
      const totalStudents = await prisma.student.count()

      return NextResponse.json({
        schoolsCount,
        activeSchools,
        totalUsers,
        totalStudents,
      })
    }

    if (session.user.role === 'SCHOOL_ADMIN') {
      // School Admin stats
      const studentsCount = await prisma.student.count({
        where: { schoolId: schoolId || undefined },
      })

      const teachersCount = await prisma.user.count({
        where: {
          schoolId: schoolId || undefined,
          role: 'TEACHER',
        },
      })

      const classesCount = await prisma.class.count({
        where: { schoolId: schoolId || undefined },
      })

      // Attendance stats for today
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const todayAttendance = await prisma.attendance.findMany({
        where: {
          schoolId: schoolId || undefined,
          date: today,
        },
      })

      const presentCount = todayAttendance.filter(a => a.status === 'PRESENT').length
      const attendanceRate = calculateAttendancePercentage(presentCount, todayAttendance.length)

      return NextResponse.json({
        studentsCount,
        teachersCount,
        classesCount,
        attendanceRate,
        todayAttendanceCount: todayAttendance.length,
      })
    }

    if (session.user.role === 'TEACHER') {
      // Teacher stats across all taught classes (legacy class teacher + class-subject assignments)
      const assignedRows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT DISTINCT c.id
        FROM classes c
        LEFT JOIN class_subject_teachers cst ON cst.class_id = c.id
        WHERE c.school_id = ${schoolId}
          AND (
            c.teacher_id = ${session.user.id}
            OR cst.teacher_id = ${session.user.id}
          )
      `

      const classIds = assignedRows.map((row) => row.id)
      const assignedClasses = classIds.length

      const studentsInClasses = classIds.length > 0
        ? await prisma.student.count({
            where: {
              schoolId: schoolId || undefined,
              classId: { in: classIds },
            },
          })
        : 0

      return NextResponse.json({
        assignedClasses,
        studentsInClasses,
      })
    }

    if (session.user.role === 'PARENT') {
      // Parent stats
      const children = await prisma.student.findMany({
        where: {
          parentId: session.user.id,
        },
        include: {
          attendance: {
            orderBy: { date: 'desc' },
            take: 30,
          },
          results: {
            where: { published: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      })

      const childrenStats = children.map(child => {
        const totalAttendance = child.attendance.length
        const presentCount = child.attendance.filter(a => a.status === 'PRESENT').length
        const attendanceRate = calculateAttendancePercentage(presentCount, totalAttendance)

        const averageScore = child.results.length > 0
          ? child.results.reduce((sum, r) => sum + ((r.totalScore || 0) / r.maxScore * 100), 0) / child.results.length
          : 0

        return {
          studentId: child.id,
          name: `${child.firstName} ${child.lastName}`,
          attendanceRate,
          averageScore: Math.round(averageScore),
          recentResultsCount: child.results.length,
        }
      })

      return NextResponse.json({
        childrenCount: children.length,
        children: childrenStats,
      })
    }

    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
