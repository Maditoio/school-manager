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
