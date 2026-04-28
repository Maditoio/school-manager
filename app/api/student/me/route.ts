import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'STUDENT' || !session.user.studentId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const studentId = session.user.studentId

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      class: {
        include: {
          subjectAssignments: {
            include: { subject: true },
          },
        },
      },
      parent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      attendance: {
        orderBy: { date: 'desc' },
        take: 60,
        select: { status: true, date: true },
      },
      studentAssessments: {
        where: {
          assessment: {
            published: true,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          assessment: {
            include: { subject: true },
          },
        },
      },
    },
  })

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  let studentCourseProfile = null
  try {
    studentCourseProfile = await prisma.studentCourseProfile.findFirst({
      where: { studentId },
      orderBy: { updatedAt: 'desc' },
    })
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2021'
    ) {
      console.warn('StudentCourseProfile table is missing, returning null profile', error)
      studentCourseProfile = null
    } else {
      throw error
    }
  }

  const totalAttendance = student.attendance.length
  const presentCount = student.attendance.filter(a => a.status === 'PRESENT').length
  const attendanceRate = totalAttendance > 0
    ? Math.round((presentCount / totalAttendance) * 100)
    : 0

  const restrictedFeaturesBlocked = Boolean(session.user.paymentAccessBlocked)
  const attendance = restrictedFeaturesBlocked ? [] : student.attendance
  const studentAssessments = restrictedFeaturesBlocked ? [] : student.studentAssessments

  return NextResponse.json({
    student: {
      ...student,
      attendance,
      studentAssessments,
      attendanceSummary: {
        total: restrictedFeaturesBlocked ? 0 : totalAttendance,
        present: restrictedFeaturesBlocked ? 0 : presentCount,
        absent: restrictedFeaturesBlocked ? 0 : student.attendance.filter(a => a.status === 'ABSENT').length,
        rate: restrictedFeaturesBlocked ? 0 : attendanceRate,
      },
    },
    studentCourseProfile: studentCourseProfile || null,
  })
}
