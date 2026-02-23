import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/schools/[id] - Get school details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: schoolId } = await params

    // Check access
    if (session.user.role !== 'SUPER_ADMIN' && session.user.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        _count: {
          select: {
            users: true,
            students: true,
            classes: true,
            subjects: true,
          },
        },
      },
    })

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }

    return NextResponse.json({ school })
  } catch (error) {
    console.error('Error fetching school:', error)
    return NextResponse.json(
      { error: 'Failed to fetch school' },
      { status: 500 }
    )
  }
}

// PATCH /api/schools/[id] - Update school (Super Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: schoolId } = await params

    const school = await prisma.school.update({
      where: { id: schoolId },
      data: {
        name: body.name,
        plan: body.plan,
        active: body.active,
      },
    })

    return NextResponse.json({ school })
  } catch (error) {
    console.error('Error updating school:', error)
    return NextResponse.json(
      { error: 'Failed to update school' },
      { status: 500 }
    )
  }
}

// DELETE /api/schools/[id] - Delete school (Super Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: schoolId } = await params

    await prisma.school.delete({
      where: { id: schoolId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting school:', error)
    return NextResponse.json(
      { error: 'Failed to delete school' },
      { status: 500 }
    )
  }
}
