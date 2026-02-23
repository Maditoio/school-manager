import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasRole } from "@/lib/auth-utils"

// POST /api/deletion-requests/[id]/execute - Execute a scheduled deletion
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

    if (deletionRequest.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Deletion request must be approved before execution' },
        { status: 400 }
      )
    }

    // Execute the deletion
    await deleteResource(deletionRequest)

    // Mark as executed
    const updated = await prisma.deletionRequest.update({
      where: { id: deletionRequestId },
      data: {
        status: 'EXECUTED',
        executedAt: new Date(),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ deletionRequest: updated })
  } catch (error) {
    console.error('Error executing deletion:', error)
    return NextResponse.json(
      { error: 'Failed to execute deletion' },
      { status: 500 }
    )
  }
}

async function deleteResource(deletionRequest: {
  resourceType: string
  resourceId: string
}) {
  if (deletionRequest.resourceType === 'class') {
    // Delete in transaction: first delete related records, then students, then class
    await prisma.$transaction(async (tx) => {
      // Find all students in the class
      const students = await tx.student.findMany({
        where: { classId: deletionRequest.resourceId },
        select: { id: true },
      })

      const studentIds = students.map((s) => s.id)

      // Delete attendance records for these students
      if (studentIds.length > 0) {
        await tx.attendance.deleteMany({
          where: { studentId: { in: studentIds } },
        })

        // Delete results for these students
        await tx.result.deleteMany({
          where: { studentId: { in: studentIds } },
        })
      }

      // Delete students
      await tx.student.deleteMany({
        where: { classId: deletionRequest.resourceId },
      })

      // Delete the class
      await tx.class.delete({
        where: { id: deletionRequest.resourceId },
      })
    })
  }
}
