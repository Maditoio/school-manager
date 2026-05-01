import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getVideoCoursesEnabledForSchool } from '@/lib/video-courses-feature'
import { retrieveStripeCheckoutSession } from '@/lib/stripe'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id: courseId } = await params
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const featureEnabled = await getVideoCoursesEnabledForSchool(session.user.schoolId!)
  if (!featureEnabled) {
    return NextResponse.json(
      { error: 'Video courses are currently disabled for your school.', code: 'FEATURE_DISABLED' },
      { status: 403 }
    )
  }

  const stripeSession = await retrieveStripeCheckoutSession(sessionId)
  if (stripeSession.payment_status !== 'paid' || stripeSession.status !== 'complete') {
    return NextResponse.json({ error: 'Payment session is not complete' }, { status: 402 })
  }

  if (stripeSession.metadata?.courseId !== courseId) {
    return NextResponse.json({ error: 'Checkout session does not belong to this course' }, { status: 403 })
  }

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, schoolId: session.user.schoolId! },
  })
  if (!student) return NextResponse.json({ error: 'Student record not found' }, { status: 404 })

  if (stripeSession.metadata?.studentId !== student.id) {
    return NextResponse.json({ error: 'Checkout session does not belong to this user' }, { status: 403 })
  }

  const schoolSettings = await prisma.schoolSettings.findUnique({
    where: { schoolId: session.user.schoolId! },
    select: { allowCrossSchoolCourses: true },
  })
  const allowCrossSchool = schoolSettings?.allowCrossSchoolCourses === true

  const course = await prisma.videoCourse.findFirst({
    where: {
      id: courseId,
      published: true,
      OR: [
        { schoolId: session.user.schoolId! },
        ...(allowCrossSchool ? [{
          allSchools: true,
          school: { schoolSettings: { allowCrossSchoolCourses: true } },
        }] : []),
      ],
    },
  })
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  const existing = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId: student.id } },
  })

  if (existing) {
    return NextResponse.json({ enrollment: existing })
  }

  const enrollment = await prisma.courseEnrollment.create({
    data: {
      courseId,
      studentId: student.id,
      schoolId: session.user.schoolId!,
      paid: true,
      paidAt: new Date(),
      amountPaid: course.price,
      paymentRef: `stripe:${sessionId}`,
    },
  })

  return NextResponse.json({ enrollment })
}
