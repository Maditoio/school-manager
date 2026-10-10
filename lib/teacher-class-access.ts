import { prisma } from '@/lib/prisma'

/**
 * Classes a teacher can use: homeroom (`Class.teacherId`) ∪ subject assignments
 * (`ClassSubjectTeacher`). Homeroom remains the "class teacher" display field.
 */
export async function getTeacherAccessibleClassIds(
  teacherId: string,
  schoolId: string
): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT DISTINCT c.id
    FROM classes c
    LEFT JOIN class_subject_teachers cst ON cst.class_id = c.id
    WHERE c.school_id = ${schoolId}
      AND (
        c.teacher_id = ${teacherId}
        OR cst.teacher_id = ${teacherId}
      )
  `
  return rows.map((row) => row.id)
}

export async function teacherCanAccessClass(
  teacherId: string,
  schoolId: string,
  classId: string
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT c.id
    FROM classes c
    LEFT JOIN class_subject_teachers cst ON cst.class_id = c.id
    WHERE c.id = ${classId}
      AND c.school_id = ${schoolId}
      AND (
        c.teacher_id = ${teacherId}
        OR cst.teacher_id = ${teacherId}
      )
    LIMIT 1
  `
  return rows.length > 0
}

/** Subject-level create/grade gate — requires a ClassSubjectTeacher row. */
export async function teacherCanTeachSubject(
  teacherId: string,
  schoolId: string,
  classId: string,
  subjectId: string
): Promise<boolean> {
  const assignment = await prisma.classSubjectTeacher.findFirst({
    where: {
      teacherId,
      schoolId,
      classId,
      subjectId,
    },
    select: { id: true },
  })
  return Boolean(assignment)
}
