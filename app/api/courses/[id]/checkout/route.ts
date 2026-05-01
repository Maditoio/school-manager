import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getVideoCoursesEnabledForSchool } from '@/lib/video-courses-feature'
import { createStripeCheckoutSession } from '@/lib/stripe'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id: courseId } = await params
  const featureEnabled = await getVideoCoursesEnabledForSchool(session.user.schoolId!)
  if (!featureEnabled) {
    return NextResponse.json(
      { error: 'Video courses are currently disabled for your school.', code: 'FEATURE_DISABLED' },
      { status: 403 }
    )
  }

  const schoolSettings = await prisma.schoolSettings.findUnique({
    where: { schoolId: session.user.schoolId! },
    select: { allowCrossSchoolCourses: true, currency: true },
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
  if (course.price <= 0) {
    return NextResponse.json({ error: 'This course is free. Enroll directly instead.' }, { status: 400 })
  }

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, schoolId: session.user.schoolId! },
  })
  if (!student) return NextResponse.json({ error: 'Student record not found' }, { status: 404 })

  const amountCents = Math.round(course.price * 100)
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const successUrl = `${origin}/student/hub/course/${courseId}?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${origin}/student/hub/course/${courseId}`

  try {
    const sessionData = await createStripeCheckoutSession({
      courseId,
      courseTitle: course.title,
      courseDescription: course.description,
      amountCents,
      currency: 'usd',  // Stripe only supports specific currencies; always use USD
      successUrl,
      cancelUrl,
      studentId: student.id,
    })

    return NextResponse.json({ url: sessionData.url })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create payment session'
    console.error('Stripe checkout session creation failed:', errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
