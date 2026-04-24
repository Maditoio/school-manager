import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/courses - browse published courses (students) or own courses (teachers)
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mine = searchParams.get('mine') === 'true'

  if (mine && session.user.role === 'TEACHER') {
    const courses = await prisma.videoCourse.findMany({
      where: { teacherId: session.user.id, schoolId: session.user.schoolId! },
      include: {
        lessons: { orderBy: { lessonOrder: 'asc' } },
        _count: { select: { enrollments: true, ratings: true } },
        ratings: { select: { rating: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ courses })
  }

  // Public browse — published courses for the school + cross-school courses
  const schoolId = session.user.schoolId!

  // Get all published courses: own school + any school-shared from schools that allow it
  const courses = await prisma.videoCourse.findMany({
    where: {
      published: true,
      OR: [
        { schoolId },
        {
          allSchools: true,
          school: { schoolSettings: { allowCrossSchoolCourses: true } },
        },
      ],
    },
    include: {
      teacher: { select: { firstName: true, lastName: true } },
      school: { select: { id: true, name: true } },
      lessons: { select: { id: true, isFreePreview: true, duration: true } },
      _count: { select: { enrollments: true, ratings: true } },
      ratings: { select: { rating: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ courses })
}

// POST /api/courses - teacher creates a course
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { title, description, price, thumbnailUrl, allSchools } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  // allSchools is only allowed if admin has enabled cross-school courses
  let resolvedAllSchools = false
  if (allSchools === true) {
    const settings = await prisma.schoolSettings.findUnique({
      where: { schoolId: session.user.schoolId! },
      select: { allowCrossSchoolCourses: true },
    })
    resolvedAllSchools = settings?.allowCrossSchoolCourses === true
  }

  const course = await prisma.videoCourse.create({
    data: {
      schoolId: session.user.schoolId!,
      teacherId: session.user.id,
      title: title.trim(),
      description: description?.trim() ?? null,
      price: typeof price === 'number' ? price : 0,
      thumbnailUrl: thumbnailUrl ?? null,
      allSchools: resolvedAllSchools,
    },
  })

  return NextResponse.json({ course }, { status: 201 })
}
