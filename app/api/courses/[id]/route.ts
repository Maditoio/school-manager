import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/courses/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const course = await prisma.videoCourse.findFirst({
    where: { id, schoolId: session.user.schoolId! },
    include: {
      teacher: { select: { firstName: true, lastName: true } },
      lessons: { orderBy: { lessonOrder: 'asc' } },
      _count: { select: { enrollments: true, ratings: true } },
      ratings: { select: { rating: true, review: true, student: { select: { firstName: true, lastName: true } } } },
    },
  })

  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // For students: hide video URLs of non-free lessons unless enrolled & paid
  if (session.user.role === 'STUDENT') {
    const studentRecord = await prisma.student.findFirst({
      where: { userId: session.user.id, schoolId: session.user.schoolId! },
    })
    const enrollment = studentRecord
      ? await prisma.courseEnrollment.findUnique({
          where: { courseId_studentId: { courseId: id, studentId: studentRecord.id } },
        })
      : null
    const hasFullAccess = enrollment?.paid === true

    return NextResponse.json({
      course: {
        ...course,
        lessons: course.lessons.map(l => ({
          ...l,
          videoUrl: l.isFreePreview || hasFullAccess ? l.videoUrl : null,
        })),
      },
      enrollment,
      hasFullAccess,
    })
  }

  return NextResponse.json({ course })
}

// PATCH /api/courses/[id] - teacher updates course metadata
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  const course = await prisma.videoCourse.findFirst({
    where: { id, teacherId: session.user.id },
  })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { title, description, price, thumbnailUrl, published } = body

  const updated = await prisma.videoCourse.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: String(title).trim() }),
      ...(description !== undefined && { description: String(description).trim() }),
      ...(price !== undefined && { price: Number(price) }),
      ...(thumbnailUrl !== undefined && { thumbnailUrl }),
      ...(published !== undefined && { published: Boolean(published) }),
    },
  })

  return NextResponse.json({ course: updated })
}

// DELETE /api/courses/[id] - teacher deletes a course
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params

  const course = await prisma.videoCourse.findFirst({
    where: { id, teacherId: session.user.id },
  })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.videoCourse.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
