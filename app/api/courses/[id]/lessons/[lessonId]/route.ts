import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/courses/[id]/lessons/[lessonId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id: courseId, lessonId } = await params

  const course = await prisma.videoCourse.findFirst({ where: { id: courseId, teacherId: session.user.id } })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { title, description, videoUrl, duration, lessonOrder, isFreePreview } = body

  const updated = await prisma.videoLesson.update({
    where: { id: lessonId },
    data: {
      ...(title !== undefined && { title: String(title).trim() }),
      ...(description !== undefined && { description }),
      ...(videoUrl !== undefined && { videoUrl }),
      ...(duration !== undefined && { duration: Number(duration) }),
      ...(lessonOrder !== undefined && { lessonOrder: Number(lessonOrder) }),
      ...(isFreePreview !== undefined && { isFreePreview: Boolean(isFreePreview) }),
    },
  })

  // Recalculate total duration
  const allLessons = await prisma.videoLesson.findMany({ where: { courseId }, select: { duration: true } })
  const totalDuration = allLessons.reduce((s, l) => s + (l.duration ?? 0), 0)
  await prisma.videoCourse.update({ where: { id: courseId }, data: { totalDuration } })

  return NextResponse.json({ lesson: updated })
}

// DELETE /api/courses/[id]/lessons/[lessonId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id: courseId, lessonId } = await params

  const course = await prisma.videoCourse.findFirst({ where: { id: courseId, teacherId: session.user.id } })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.videoLesson.delete({ where: { id: lessonId } })

  const allLessons = await prisma.videoLesson.findMany({ where: { courseId }, select: { duration: true } })
  const totalDuration = allLessons.reduce((s, l) => s + (l.duration ?? 0), 0)
  await prisma.videoCourse.update({ where: { id: courseId }, data: { totalDuration } })

  return NextResponse.json({ success: true })
}
