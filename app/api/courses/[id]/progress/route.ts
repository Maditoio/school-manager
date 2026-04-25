import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/courses/[id]/progress - save lesson progress
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

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

  const { id: courseId } = await params
  const body = await request.json()
  const { lessonId, lastPosition, completed } = body

  if (!lessonId) return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, schoolId: session.user.schoolId! },
  })
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId: student.id } },
  })
  if (!enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })

  const progress = await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
    create: {
      enrollmentId: enrollment.id,
      lessonId,
      studentId: student.id,
      lastPosition: lastPosition ?? 0,
      completed: Boolean(completed),
      completedAt: completed ? new Date() : null,
    },
    update: {
      lastPosition: lastPosition ?? 0,
      ...(completed && { completed: true, completedAt: new Date() }),
    },
  })

  return NextResponse.json({ progress })
}

// GET /api/courses/[id]/progress - get all lesson progress for the student
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const settings = await prisma.schoolSettings.findUnique({
    where: { schoolId: session.user.schoolId! },
    select: { videoCoursesEnabled: true },
  })
  if (settings?.videoCoursesEnabled === false) {
    return NextResponse.json({ progress: [], featureEnabled: false })
  }

  const { id: courseId } = await params

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, schoolId: session.user.schoolId! },
  })
  if (!student) return NextResponse.json({ progress: [] })

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId: student.id } },
  })
  if (!enrollment) return NextResponse.json({ progress: [] })

  const progress = await prisma.lessonProgress.findMany({
    where: { enrollmentId: enrollment.id },
  })

  return NextResponse.json({ progress })
}
