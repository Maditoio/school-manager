import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { announcementSchema } from "@/lib/validations"
import { hasRole } from "@/lib/auth-utils"

// GET /api/announcements - Get school and class announcements
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const childId = searchParams.get('childId')

    const where: Record<string, unknown> = {}

    // Filter by school for non-super admins
    if (session.user.schoolId) {
      where.schoolId = session.user.schoolId
    }

    // Get school announcements
    const announcements = await prisma.announcement.findMany({
      where,
      include: {
        creator: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Get class announcements if childId is provided
    let classAnnouncements: Awaited<ReturnType<typeof prisma.classAnnouncement.findMany>> = []
    if (childId) {
      const student = await prisma.student.findUnique({
        where: { id: childId },
        select: {
          classId: true,
        },
      })

      if (student?.classId) {
        classAnnouncements = await prisma.classAnnouncement.findMany({
          where: {
            schoolId: session.user.schoolId || '',
            classId: student.classId,
          },
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
      }
    }

    // Combine and sort by date
    const combined = [
      ...announcements.map((a) => ({ ...a, type: 'school' as const })),
      ...classAnnouncements.map((a) => ({ ...a, type: 'class' as const })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({ announcements: combined })
  } catch (error) {
    console.error('Error fetching announcements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch announcements' },
      { status: 500 }
    )
  }
}

// POST /api/announcements - Create announcement
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = announcementSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { title, message, priority } = validation.data

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'School ID required' },
        { status: 400 }
      )
    }

    const announcement = await prisma.announcement.create({
      data: {
        schoolId: session.user.schoolId,
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
      },
    })

    return NextResponse.json({ announcement }, { status: 201 })
  } catch (error) {
    console.error('Error creating announcement:', error)
    return NextResponse.json(
      { error: 'Failed to create announcement' },
      { status: 500 }
    )
  }
}
