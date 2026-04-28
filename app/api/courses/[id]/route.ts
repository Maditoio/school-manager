import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getVideoCoursesEnabledForSchool } from '@/lib/video-courses-feature'

// GET /api/courses/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (session.user.role === 'STUDENT') {
    const featureEnabled = await getVideoCoursesEnabledForSchool(session.user.schoolId!)

    if (!featureEnabled) {
      return NextResponse.json(
        { error: 'Video courses are currently disabled for your school.', code: 'FEATURE_DISABLED' },
        { status: 403 }
      )
    }
  }

  let courseWhere: any

  if (session.user.role === 'STUDENT') {
    // Check if the school allows cross-school courses for viewing
    const schoolSettings = await prisma.schoolSettings.findUnique({
      where: { schoolId: session.user.schoolId! },
      select: { allowCrossSchoolCourses: true },
    })
    const allowCrossSchool = schoolSettings?.allowCrossSchoolCourses === true

    courseWhere = {
      id,
      published: true,
      OR: [
        { schoolId: session.user.schoolId! },
        ...(allowCrossSchool ? [{
          allSchools: true,
          school: { schoolSettings: { allowCrossSchoolCourses: true } },
        }] : []),
      ],
    }
  } else {
    courseWhere = { id, schoolId: session.user.schoolId! }
  }

  const course = await prisma.videoCourse.findFirst({
    where: courseWhere,
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

  const { title, description, price, thumbnailUrl, published, allSchools } = body

  // Validate allSchools: only allow true if admin has enabled cross-school courses
  let resolvedAllSchools: boolean | undefined
  if (allSchools !== undefined) {
    if (!allSchools) {
      resolvedAllSchools = false
    } else {
      const settings = await prisma.schoolSettings.findUnique({
        where: { schoolId: course.schoolId },
        select: { allowCrossSchoolCourses: true },
      })
      resolvedAllSchools = settings?.allowCrossSchoolCourses === true
    }
  }

  const updated = await prisma.videoCourse.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: String(title).trim() }),
      ...(description !== undefined && { description: String(description).trim() }),
      ...(price !== undefined && { price: Number(price) }),
      ...(thumbnailUrl !== undefined && { thumbnailUrl }),
      ...(published !== undefined && { published: Boolean(published) }),
      ...(resolvedAllSchools !== undefined && { allSchools: resolvedAllSchools }),
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
