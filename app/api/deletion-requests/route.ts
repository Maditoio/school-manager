import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasRole } from "@/lib/auth-utils"

// GET /api/deletion-requests - List deletion requests for a school
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only school admins can view deletion requests
    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'

    const deletionRequests = await prisma.deletionRequest.findMany({
      where: {
        schoolId: session.user.schoolId,
        status: status || undefined,
      },
      include: {
        requestor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ deletionRequests })
  } catch (error) {
    console.error('Error fetching deletion requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deletion requests' },
      { status: 500 }
    )
  }
}

// POST /api/deletion-requests - Create a new deletion request
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { resourceType, resourceId, resourceName, reason } = body

    // Verify the resource exists and belongs to this school
    if (resourceType === 'class') {
      const classData = await prisma.class.findUnique({
        where: { id: resourceId },
      })

      if (!classData || classData.schoolId !== session.user.schoolId) {
        return NextResponse.json(
          { error: 'Resource not found' },
          { status: 404 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid resource type' },
        { status: 400 }
      )
    }

    // Create deletion request scheduled for 30 days from now
    const scheduledFor = new Date()
    scheduledFor.setDate(scheduledFor.getDate() + 30)

    const deletionRequest = await prisma.deletionRequest.create({
      data: {
        schoolId: session.user.schoolId,
        resourceType,
        resourceId,
        resourceName,
        requestedBy: session.user.id,
        reason: reason || null,
        scheduledFor,
        status: 'PENDING',
      },
      include: {
        requestor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ deletionRequest }, { status: 201 })
  } catch (error) {
    console.error('Error creating deletion request:', error)
    return NextResponse.json(
      { error: 'Failed to create deletion request' },
      { status: 500 }
    )
  }
}
