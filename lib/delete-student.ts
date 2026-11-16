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
 * Writes a SchoolAuditLog entry so admins can review deletions.
 */
export async function deleteStudentCompletely(
  db: DbClient,
  params: {
    studentId: string
    schoolId: string
    actorId?: string | null
  }
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
      classId: true,
      parentId: true,
      status: true,
      class: { select: { name: true } },
    },
  })

  if (!student) {
    throw new StudentDeleteError('Student not found', 404)
  }

  const studentName = `${student.firstName} ${student.lastName}`.trim()
  const summary = student.admissionNumber
    ? `Deleted student ${studentName} (${student.admissionNumber})`
    : `Deleted student ${studentName}`

  // Audit before hard delete so the snapshot is preserved even after the row is gone.
  await db.schoolAuditLog.create({
    data: {
      schoolId: params.schoolId,
      actorId: params.actorId || null,
      resourceType: 'student',
      resourceId: student.id,
      action: 'delete',
      summary,
      metadata: {
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNumber: student.admissionNumber,
        classId: student.classId,
        className: student.class?.name || null,
        parentId: student.parentId,
        status: student.status,
        hadLogin: Boolean(student.userId),
      },
    },
  })

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
    name: studentName,
    admissionNumber: student.admissionNumber,
  }
}
