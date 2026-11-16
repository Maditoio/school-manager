import type { Prisma, PrismaClient } from '@prisma/client'

type DbClient = PrismaClient | Prisma.TransactionClient

export class StudentDeleteError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'StudentDeleteError'
    this.status = status
  }
}

/**
 * Permanently remove a student from a school, including related cascade data
 * and the student login User when present. Parent accounts are never deleted.
 */
export async function deleteStudentCompletely(
  db: DbClient,
  params: { studentId: string; schoolId: string }
) {
  const student = await db.student.findFirst({
    where: {
      id: params.studentId,
      schoolId: params.schoolId,
    },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
    },
  })

  if (!student) {
    throw new StudentDeleteError('Student not found', 404)
  }

  // Keep expense / complaint audit trails; unlink the student FK (no onDelete).
  await db.expense.updateMany({
    where: { studentId: student.id, schoolId: params.schoolId },
    data: { studentId: null },
  })

  await db.parentComplaint.updateMany({
    where: { studentId: student.id, schoolId: params.schoolId },
    data: { studentId: null },
  })

  if (student.userId) {
    const loginUserId = student.userId

    await db.student.update({
      where: { id: student.id },
      data: { userId: null },
    })

    // Messages have no onDelete for sender/receiver — clear before deleting the login user.
    await db.message.deleteMany({
      where: {
        OR: [{ senderId: loginUserId }, { receiverId: loginUserId }],
      },
    })

    await db.user.delete({
      where: { id: loginUserId },
    })
  }

  await db.student.delete({
    where: { id: student.id },
  })

  return {
    id: student.id,
    name: `${student.firstName} ${student.lastName}`.trim(),
    admissionNumber: student.admissionNumber,
  }
}
