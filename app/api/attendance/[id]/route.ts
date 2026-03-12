import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasRole } from "@/lib/auth-utils"
import { assertTermEditableById, TermLockedError } from '@/lib/term-utils'

// GET /api/attendance/[id] - Get attendance record details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: attendanceId } = await params

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    return NextResponse.json({ attendance })
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    )
  }
}

// PUT /api/attendance/[id] - Update attendance record
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: attendanceId } = await params

    const existing = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: {
        id: true,
        schoolId: true,
        term_id: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    if (session.user.schoolId && existing.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await assertTermEditableById({ schoolId: existing.schoolId, termId: existing.term_id })

    const attendance = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        status: body.status,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json({ attendance })
  } catch (error) {
    console.error('Error updating attendance:', error)
    if (error instanceof TermLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(
      { error: 'Failed to update attendance' },
      { status: 500 }
    )
  }
}

// DELETE /api/attendance/[id] - Delete attendance record
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: attendanceId } = await params

    const existing = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: {
        id: true,
        schoolId: true,
        term_id: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    if (session.user.schoolId && existing.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await assertTermEditableById({ schoolId: existing.schoolId, termId: existing.term_id })

    await prisma.attendance.delete({
      where: { id: attendanceId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting attendance:', error)
    if (error instanceof TermLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(
      { error: 'Failed to delete attendance' },
      { status: 500 }
    )
  }
}
