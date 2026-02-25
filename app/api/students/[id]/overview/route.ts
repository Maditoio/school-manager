import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

type AttendanceStatusCountRow = {
  status: 'PRESENT' | 'ABSENT' | 'LATE'
  _count: { _all: number }
}

type SubjectAssignmentRow = {
  subject: {
    id: string
    name: string
    code: string | null
  }
  teacher: {
    firstName: string | null
    lastName: string | null
  }
}

type StudentStatusHistoryRow = {
  id: string
  status: 'ACTIVE' | 'LEFT'
  reason: 'SUSPENSION' | 'GRADUATION' | 'TRANSFERRED_SCHOOL' | 'OTHER' | null
  effectiveAt: Date
  notes: string | null
  changedBy: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  } | null
}

async function getSubjectsForClass(classId: string, schoolId: string): Promise<SubjectAssignmentRow[]> {
  const prismaAny = prisma as unknown as {
    classSubjectTeacher?: {
      findMany: (args: unknown) => Promise<SubjectAssignmentRow[]>
    }
  }

  if (prismaAny.classSubjectTeacher?.findMany) {
    return prismaAny.classSubjectTeacher.findMany({
      where: {
        classId,
        schoolId,
      },
      select: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })
  }

  const rows = await prisma.$queryRaw<Array<{
    subject_id: string
    subject_name: string
    subject_code: string | null
    teacher_first_name: string | null
    teacher_last_name: string | null
  }>>`
    SELECT
      s.id AS subject_id,
      s.name AS subject_name,
      s.code AS subject_code,
      u.first_name AS teacher_first_name,
      u.last_name AS teacher_last_name
    FROM class_subject_teachers cst
    INNER JOIN subjects s ON s.id = cst.subject_id
    INNER JOIN users u ON u.id = cst.teacher_id
    WHERE cst.class_id = ${classId} AND cst.school_id = ${schoolId}
    ORDER BY s.name ASC
  `

  return rows.map((row) => ({
    subject: {
      id: row.subject_id,
      name: row.subject_name,
      code: row.subject_code,
    },
    teacher: {
      firstName: row.teacher_first_name,
      lastName: row.teacher_last_name,
    },
  }))
}

async function getStudentClassHistory(studentId: string) {
  const prismaAny = prisma as unknown as {
    studentClassHistory?: {
      findMany: (args: unknown) => Promise<unknown[]>
    }
  }

  if (prismaAny.studentClassHistory?.findMany) {
    return prismaAny.studentClassHistory.findMany({
      where: { studentId },
      include: {
        fromClass: {
          select: {
            id: true,
            name: true,
            grade: true,
            academicYear: true,
          },
        },
        toClass: {
          select: {
            id: true,
            name: true,
            grade: true,
            academicYear: true,
          },
        },
        changedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { effectiveAt: 'desc' },
    })
  }

  const rows = await prisma.$queryRaw<Array<{
    id: string
    effective_at: Date
    reason: string | null
    from_class_id: string | null
    from_class_name: string | null
    from_class_grade: string | null
    from_class_year: number | null
    to_class_id: string
    to_class_name: string
    to_class_grade: string | null
    to_class_year: number
    changed_by_id: string | null
    changed_by_first_name: string | null
    changed_by_last_name: string | null
    changed_by_email: string | null
  }>>`
    SELECT
      h.id,
      h.effective_at,
      h.reason,
      h.from_class_id,
      cf.name AS from_class_name,
      cf.grade AS from_class_grade,
      cf.academic_year AS from_class_year,
      h.to_class_id,
      ct.name AS to_class_name,
      ct.grade AS to_class_grade,
      ct.academic_year AS to_class_year,
      h.changed_by_id,
      u.first_name AS changed_by_first_name,
      u.last_name AS changed_by_last_name,
      u.email AS changed_by_email
    FROM student_class_history h
    LEFT JOIN classes cf ON cf.id = h.from_class_id
    INNER JOIN classes ct ON ct.id = h.to_class_id
    LEFT JOIN users u ON u.id = h.changed_by_id
    WHERE h.student_id = ${studentId}
    ORDER BY h.effective_at DESC
  `

  return rows.map((row) => ({
    id: row.id,
    effectiveAt: row.effective_at,
    reason: row.reason,
    fromClass: row.from_class_id
      ? {
          id: row.from_class_id,
          name: row.from_class_name,
          grade: row.from_class_grade,
          academicYear: row.from_class_year,
        }
      : null,
    toClass: {
      id: row.to_class_id,
      name: row.to_class_name,
      grade: row.to_class_grade,
      academicYear: row.to_class_year,
    },
    changedBy: row.changed_by_id
      ? {
          id: row.changed_by_id,
          firstName: row.changed_by_first_name,
          lastName: row.changed_by_last_name,
          email: row.changed_by_email,
        }
      : null,
  }))
}

async function getStudentStatusHistory(studentId: string): Promise<StudentStatusHistoryRow[]> {
  const prismaAny = prisma as unknown as {
    studentStatusHistory?: {
      findMany: (args: unknown) => Promise<StudentStatusHistoryRow[]>
    }
  }

  if (prismaAny.studentStatusHistory?.findMany) {
    return prismaAny.studentStatusHistory.findMany({
      where: { studentId },
      include: {
        changedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
    })
  }

  return []
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: studentId } = await params

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        ...(session.user.schoolId ? { schoolId: session.user.schoolId } : {}),
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
        parent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const [attendanceByStatus, recentAttendance, subjectAssignments, results, assessmentSummary, classHistory, statusHistory] = await Promise.all([
      prisma.attendance.groupBy({
        by: ['status'],
        where: { studentId: student.id },
        _count: { _all: true },
      }),
      prisma.attendance.findMany({
        where: { studentId: student.id },
        orderBy: { date: 'desc' },
        take: 30,
        select: {
          id: true,
          date: true,
          status: true,
          notes: true,
        },
      }),
      getSubjectsForClass(student.classId, student.schoolId),
      prisma.result.findMany({
        where: { studentId: student.id },
        include: {
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: [{ year: 'desc' }, { term: 'desc' }, { updatedAt: 'desc' }],
        take: 40,
      }),
      prisma.studentAssessment.aggregate({
        where: { studentId: student.id, graded: true },
        _count: { _all: true },
        _avg: { score: true },
      }),
      getStudentClassHistory(student.id),
      getStudentStatusHistory(student.id),
    ])

    const attendanceSummary = (attendanceByStatus as AttendanceStatusCountRow[]).reduce(
      (acc, row: AttendanceStatusCountRow) => {
        if (row.status === 'PRESENT') acc.present = row._count._all
        if (row.status === 'ABSENT') acc.absent = row._count._all
        if (row.status === 'LATE') acc.late = row._count._all
        return acc
      },
      { present: 0, absent: 0, late: 0 }
    )

    const subjects = (subjectAssignments as SubjectAssignmentRow[]).map((item: SubjectAssignmentRow) => ({
      id: item.subject.id,
      name: item.subject.name,
      code: item.subject.code,
      teacherName: `${item.teacher.firstName || ''} ${item.teacher.lastName || ''}`.trim() || 'Not assigned',
    }))

    return NextResponse.json({
      student,
      attendanceSummary,
      recentAttendance,
      subjects,
      results,
      assessmentSummary: {
        gradedCount: assessmentSummary._count._all,
        averageScore: assessmentSummary._avg.score,
      },
      classHistory,
      statusHistory,
    })
  } catch (error) {
    console.error('Error fetching student overview:', error)
    return NextResponse.json({ error: 'Failed to fetch student overview' }, { status: 500 })
  }
}
