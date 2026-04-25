import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/courses/[id]/enroll - student subscribes (free preview or paid)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id: courseId } = await params

  const settings = await prisma.schoolSettings.findUnique({
    where: { schoolId: session.user.schoolId! },
    select: { videoCoursesEnabled: true },
  })
  if (settings?.videoCoursesEnabled === false) {
    return NextResponse.json(
      { error: 'Video courses are currently disabled for your school.', code: 'FEATURE_DISABLED' },
      { status: 403 }
    )
  }

  const course = await prisma.videoCourse.findFirst({
    where: {
      id: courseId,
      published: true,
      OR: [
        { schoolId: session.user.schoolId! },
        {
          allSchools: true,
          school: { schoolSettings: { allowCrossSchoolCourses: true } },
        },
      ],
    },
  })
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, schoolId: session.user.schoolId! },
  })
  if (!student) return NextResponse.json({ error: 'Student record not found' }, { status: 404 })

  const existing = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId: student.id } },
  })
  if (existing) return NextResponse.json({ enrollment: existing })

  const enrollment = await prisma.courseEnrollment.create({
    data: {
      courseId,
      studentId: student.id,
      schoolId: session.user.schoolId!,
      paid: course.price === 0,
      amountPaid: 0,
    },
  })

  return NextResponse.json({ enrollment }, { status: 201 })
}

// PATCH /api/courses/[id]/enroll - mark as paid (admin/teacher confirms payment)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || !['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'TEACHER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id: courseId } = await params
  const body = await request.json()
  const { studentId, amountPaid, paymentRef } = body

  if (!studentId) return NextResponse.json({ error: 'studentId is required' }, { status: 400 })

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
  })
  if (!enrollment) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })

  const updated = await prisma.courseEnrollment.update({
    where: { courseId_studentId: { courseId, studentId } },
    data: {
      paid: true,
      paidAt: new Date(),
      amountPaid: typeof amountPaid === 'number' ? amountPaid : enrollment.amountPaid,
      paymentRef: paymentRef ?? null,
    },
  })

  return NextResponse.json({ enrollment: updated })
}
