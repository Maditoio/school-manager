import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasRole } from "@/lib/auth-utils"

interface CreateClassAnnouncementRequest {
  title: string
  message: string
  classId: string
  priority?: string
}

// POST /api/class-announcements - Create class announcement
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['TEACHER'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateClassAnnouncementRequest = await request.json()
    const { title, message, classId, priority = 'normal' } = body

    if (!title || !message || !classId) {
      return NextResponse.json(
        { error: 'Title, message, and classId are required' },
        { status: 400 }
      )
    }

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'School ID required' },
        { status: 400 }
      )
    }

    // Verify the teacher is assigned to this class
    const classRecord = await prisma.class.findFirst({
      where: {
        id: classId,
        schoolId: session.user.schoolId,
        teacherId: session.user.id,
      },
    })

    if (!classRecord) {
      return NextResponse.json(
        { error: 'You are not assigned to this class' },
        { status: 403 }
      )
    }

    const classAnnouncement = await prisma.classAnnouncement.create({
      data: {
        schoolId: session.user.schoolId,
        classId,
        title,
        message,
        priority,
        createdBy: session.user.id,
      },
      include: {
        creator: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        class: {
          select: {
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ classAnnouncement }, { status: 201 })
  } catch (error) {
    console.error('Error creating class announcement:', error)
    return NextResponse.json(
      { error: 'Failed to create class announcement' },
      { status: 500 }
    )
  }
}

// GET /api/class-announcements - Get class announcements
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')

    const where: Record<string, unknown> = {}

    if (session.user.schoolId) {
      where.schoolId = session.user.schoolId
    }

    if (classId) {
      where.classId = classId
    }

    const classAnnouncements = await prisma.classAnnouncement.findMany({
      where,
      include: {
        creator: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        class: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ classAnnouncements })
  } catch (error) {
    console.error('Error fetching class announcements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch class announcements' },
      { status: 500 }
    )
  }
}
