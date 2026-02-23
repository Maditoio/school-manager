import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasRole } from "@/lib/auth-utils"

// POST /api/deletion-requests/[id]/cancel - Cancel a deletion request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: deletionRequestId } = await params

    // Get the deletion request
    const deletionRequest = await prisma.deletionRequest.findUnique({
      where: { id: deletionRequestId },
    })

    if (!deletionRequest) {
      return NextResponse.json(
        { error: 'Deletion request not found' },
        { status: 404 }
      )
    }

    if (deletionRequest.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Can only cancel PENDING or APPROVED requests
    if (deletionRequest.status === 'EXECUTED' || deletionRequest.status === 'CANCELLED') {
      return NextResponse.json(
        { error: `Cannot cancel a ${deletionRequest.status.toLowerCase()} deletion request` },
        { status: 400 }
      )
    }

    // Cancel the deletion request
    const updated = await prisma.deletionRequest.update({
      where: { id: deletionRequestId },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
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
    })

    return NextResponse.json({ deletionRequest: updated })
  } catch (error) {
    console.error('Error cancelling deletion request:', error)
    return NextResponse.json(
      { error: 'Failed to cancel deletion request' },
      { status: 500 }
    )
  }
}
