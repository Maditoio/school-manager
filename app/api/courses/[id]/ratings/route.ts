import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getVideoCoursesEnabledForSchool } from '@/lib/video-courses-feature'

// POST /api/courses/[id]/ratings
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id: courseId } = await params
  const body = await request.json()
  const { rating, review } = body

  const featureEnabled = await getVideoCoursesEnabledForSchool(session.user.schoolId!)
  if (!featureEnabled) {
    return NextResponse.json(
      { error: 'Video courses are currently disabled for your school.', code: 'FEATURE_DISABLED' },
      { status: 403 }
    )
  }

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be 1–5' }, { status: 400 })
  }

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, schoolId: session.user.schoolId! },
  })
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  // Must be enrolled
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId: student.id } },
  })
  if (!enrollment?.paid) return NextResponse.json({ error: 'Must have full access to rate' }, { status: 403 })

  const saved = await prisma.courseRating.upsert({
    where: { courseId_studentId: { courseId, studentId: student.id } },
    create: { courseId, studentId: student.id, rating, review: review ?? null },
    update: { rating, review: review ?? null },
  })

  return NextResponse.json({ rating: saved })
}
