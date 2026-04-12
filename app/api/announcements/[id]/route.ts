import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasRole } from "@/lib/auth-utils"
import { announcementSchema } from "@/lib/validations"
import { del } from '@vercel/blob'

function normalizeAnnouncementDates(startDate: string, endDate?: string | null) {
  const normalizedStartDate = new Date(startDate)
  normalizedStartDate.setHours(0, 0, 0, 0)

  if (!endDate) {
    return { startDate: normalizedStartDate, endDate: null as Date | null }
  }

  const normalizedEndDate = new Date(endDate)
  normalizedEndDate.setHours(23, 59, 59, 999)

  return { startDate: normalizedStartDate, endDate: normalizedEndDate }
}

function isBlobUrl(value?: string | null) {
  return Boolean(value && /^https:\/\/.+\.blob\.vercel-storage\.com/i.test(value))
}

// GET /api/announcements/[id] - Get announcement details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: announcementId } = await params

    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    return NextResponse.json({ announcement })
  } catch (error) {
    console.error('Error fetching announcement:', error)
    return NextResponse.json(
      { error: 'Failed to fetch announcement' },
      { status: 500 }
    )
  }
}

// PUT /api/announcements/[id] - Update announcement
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'TEACHER', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: announcementId } = await params

    const validation = announcementSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues }, { status: 400 })
    }

    const existing = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { imageUrl: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    const { title, message, priority, startDate, endDate, imageUrl } = validation.data
    const normalizedDates = normalizeAnnouncementDates(startDate, endDate)

    const announcement = await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        title,
        message,
        priority,
        startDate: normalizedDates.startDate,
        endDate: normalizedDates.endDate,
        imageUrl: imageUrl || null,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (existing.imageUrl && existing.imageUrl !== (imageUrl || null) && isBlobUrl(existing.imageUrl)) {
      try {
        await del(existing.imageUrl)
      } catch {
        // ignore cleanup failures
      }
    }

    return NextResponse.json({ announcement })
  } catch (error) {
    console.error('Error updating announcement:', error)
    return NextResponse.json(
      { error: 'Failed to update announcement' },
      { status: 500 }
    )
  }
}

// DELETE /api/announcements/[id] - Delete announcement
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'TEACHER', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: announcementId } = await params

    const existing = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { imageUrl: true },
    })

    await prisma.announcement.delete({
      where: { id: announcementId },
    })

    if (existing?.imageUrl && isBlobUrl(existing.imageUrl)) {
      try {
        await del(existing.imageUrl)
      } catch {
        // ignore cleanup failures
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting announcement:', error)
    return NextResponse.json(
      { error: 'Failed to delete announcement' },
      { status: 500 }
    )
  }
}
