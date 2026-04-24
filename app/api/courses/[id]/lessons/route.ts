import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/courses/[id]/lessons
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id: courseId } = await params

  const course = await prisma.videoCourse.findFirst({ where: { id: courseId, teacherId: session.user.id } })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { title, description, videoUrl, duration, lessonOrder, isFreePreview } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  // Determine next order if not provided
  const maxOrder = await prisma.videoLesson.aggregate({
    where: { courseId },
    _max: { lessonOrder: true },
  })
  const order = typeof lessonOrder === 'number' ? lessonOrder : (maxOrder._max.lessonOrder ?? 0) + 1

  const lesson = await prisma.videoLesson.create({
    data: {
      courseId,
      title: title.trim(),
      description: description?.trim() ?? null,
      videoUrl: videoUrl ?? null,
      duration: typeof duration === 'number' ? duration : 0,
      lessonOrder: order,
      isFreePreview: Boolean(isFreePreview),
    },
  })

  // Update total duration
  const allLessons = await prisma.videoLesson.findMany({ where: { courseId }, select: { duration: true } })
  const totalDuration = allLessons.reduce((s, l) => s + (l.duration ?? 0), 0)
  await prisma.videoCourse.update({ where: { id: courseId }, data: { totalDuration } })

  return NextResponse.json({ lesson }, { status: 201 })
}

// GET /api/courses/[id]/lessons
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: courseId } = await params

  const lessons = await prisma.videoLesson.findMany({
    where: { courseId },
    orderBy: { lessonOrder: 'asc' },
  })

  return NextResponse.json({ lessons })
}
