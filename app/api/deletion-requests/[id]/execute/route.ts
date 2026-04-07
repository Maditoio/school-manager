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

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
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
  schoolId: string
  resourceType: string
  resourceId: string
}) {
  if (deletionRequest.resourceType === 'class') {
    await prisma.$transaction(async (tx) => {
      const classData = await tx.class.findFirst({
        where: {
          id: deletionRequest.resourceId,
          schoolId: deletionRequest.schoolId,
        },
        select: {
          id: true,
          schoolId: true,
          academicYear: true,
          name: true,
        },
      })

      if (!classData) {
        return
      }

      const students = await tx.student.findMany({
        where: { classId: deletionRequest.resourceId },
        select: { id: true },
      })

      if (students.length > 0) {
        const fallbackClass = await tx.class.upsert({
          where: {
            schoolId_name_academicYear: {
              schoolId: classData.schoolId,
              name: 'Unassigned',
              academicYear: classData.academicYear,
            },
          },
          create: {
            schoolId: classData.schoolId,
            name: 'Unassigned',
            academicYear: classData.academicYear,
            grade: 'Unassigned',
          },
          update: {},
          select: { id: true },
        })

        if (fallbackClass.id === classData.id) {
          throw new Error('Cannot delete the Unassigned class while it has students.')
        }

        await tx.student.updateMany({
          where: { classId: classData.id },
          data: {
            classId: fallbackClass.id,
            academicYear: classData.academicYear,
          },
        })
      }

      await tx.class.delete({
        where: { id: classData.id },
      })
    })
  }
}
