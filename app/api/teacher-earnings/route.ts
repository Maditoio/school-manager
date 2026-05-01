import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    // Get all courses created by this teacher
    const courses = await prisma.videoCourse.findMany({
      where: {
        teacherId: session.user.id,
        schoolId: session.user.schoolId!,
      },
      select: {
        id: true,
        title: true,
        price: true,
        thumbnailUrl: true,
        _count: {
          select: {
            enrollments: true,
            lessons: true,
          },
        },
      },
    })

    // For each course, calculate earnings from paid enrollments
    const courseEarnings = await Promise.all(
      courses.map(async (course) => {
        const enrollments = await prisma.courseEnrollment.findMany({
          where: {
            courseId: course.id,
            paid: true,
          },
          select: {
            amountPaid: true,
            paidAt: true,
          },
        })

        const totalEarnings = enrollments.reduce((sum, e) => sum + (e.amountPaid || 0), 0)
        const paidEnrollments = enrollments.length

        return {
          id: course.id,
          title: course.title,
          price: course.price,
          thumbnailUrl: course.thumbnailUrl,
          totalEnrollments: course._count.enrollments,
          paidEnrollments,
          freeEnrollments: course._count.enrollments - paidEnrollments,
          totalLessons: course._count.lessons,
          totalEarnings,
        }
      })
    )

    const totalRevenue = courseEarnings.reduce((sum, c) => sum + c.totalEarnings, 0)
    const totalPaidEnrollments = courseEarnings.reduce((sum, c) => sum + c.paidEnrollments, 0)

    return NextResponse.json({
      courses: courseEarnings,
      summary: {
        totalCourses: courseEarnings.length,
        totalRevenue,
        totalPaidEnrollments,
        totalStudents: courseEarnings.reduce((sum, c) => sum + c.totalEnrollments, 0),
      },
    })
  } catch (error) {
    console.error('Failed to fetch teacher earnings:', error)
    return NextResponse.json({ error: 'Failed to fetch earnings' }, { status: 500 })
  }
}
