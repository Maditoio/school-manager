import { prisma } from "@/lib/prisma"

export async function executeScheduledDeletions() {
  try {
    // Find all approved deletion requests that have passed their scheduled time
    const now = new Date()
    
    const scheduledRequests = await prisma.deletionRequest.findMany({
      where: {
        status: 'APPROVED',
        scheduledFor: {
          lte: now,
        },
      },
    })

    if (scheduledRequests.length === 0) {
      return { executed: 0, message: 'No scheduled deletions to execute' }
    }

    let executedCount = 0

    for (const request of scheduledRequests) {
      try {
        // Execute the deletion
        await deleteResource(request)

        // Mark as executed
        await prisma.deletionRequest.update({
          where: { id: request.id },
          data: {
            status: 'EXECUTED',
            executedAt: new Date(),
            updatedAt: new Date(),
          },
        })

        executedCount++
      } catch (error) {
        console.error(`Failed to execute deletion request ${request.id}:`, error)
        // Continue with next request instead of failing completely
      }
    }

    return {
      executed: executedCount,
      message: `Successfully executed ${executedCount} scheduled deletions`,
    }
  } catch (error) {
    console.error('Error executing scheduled deletions:', error)
    throw error
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
