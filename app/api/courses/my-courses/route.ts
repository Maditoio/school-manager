import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/courses/my-courses - student's enrolled courses with progress
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, schoolId: session.user.schoolId! },
  })
  if (!student) return NextResponse.json({ courses: [] })

  const enrollments = await prisma.courseEnrollment.findMany({
    where: { studentId: student.id },
    include: {
      course: {
        include: {
          teacher: { select: { firstName: true, lastName: true } },
          lessons: { select: { id: true, duration: true } },
        },
      },
      progress: true,
    },
    orderBy: { enrolledAt: 'desc' },
  })

  const result = enrollments.map(e => {
    const totalLessons = e.course.lessons.length
    const completedLessons = e.progress.filter(p => p.completed).length
    const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

    // Find the last lesson worked on
    const lastLesson = e.progress
      .filter(p => !p.completed)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]

    return {
      enrollment: {
        id: e.id,
        paid: e.paid,
        enrolledAt: e.enrolledAt,
      },
      course: e.course,
      progress: {
        totalLessons,
        completedLessons,
        progressPct,
        lastLessonId: lastLesson?.lessonId ?? null,
      },
    }
  })

  return NextResponse.json({ courses: result })
}
