import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// DELETE /api/class-announcements/[id] - Delete class announcement
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // Verify the announcement belongs to the user (that they created it)
    const classAnnouncement = await prisma.classAnnouncement.findUnique({
      where: { id },
      select: { createdBy: true, schoolId: true },
    })

    if (!classAnnouncement) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (classAnnouncement.createdBy !== session.user.id && session.user.role !== 'SCHOOL_ADMIN' && session.user.role !== 'DEPUTY_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.classAnnouncement.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting class announcement:', error)
    return NextResponse.json(
      { error: 'Failed to delete class announcement' },
      { status: 500 }
    )
  }
}
