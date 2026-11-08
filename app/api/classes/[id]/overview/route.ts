import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN', 'TEACHER'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: classId } = await context.params

    const classData = await prisma.class.findFirst({
      where: {
        id: classId,
        ...(session.user.schoolId ? { schoolId: session.user.schoolId } : {}),
      },
      include: {
        academicYearRecord: {
          select: { id: true, year: true, name: true },
        },
        teacher: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: {
          select: { students: true, subjectAssignments: true },
        },
      },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    const [assignments, primaryStudents, additionalEnrollments, attendanceByStatus, recentAttendance, results] =
      await Promise.all([
        prisma.classSubjectTeacher.findMany({
          where: { classId, schoolId: classData.schoolId },
          include: {
            subject: { select: { id: true, name: true, code: true } },
            teacher: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: [{ teacher: { lastName: 'asc' } }, { subject: { name: 'asc' } }],
        }),
        prisma.student.findMany({
          where: { classId, schoolId: classData.schoolId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            status: true,
            gender: true,
          },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        }),
        prisma.studentAdditionalClass.findMany({
          where: { classId },
          select: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
                status: true,
                gender: true,
              },
            },
          },
          orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
        }),
        prisma.attendance.groupBy({
          by: ['status'],
          where: {
            schoolId: classData.schoolId,
            student: { classId },
          },
          _count: { _all: true },
        }),
        prisma.attendance.findMany({
          where: {
            schoolId: classData.schoolId,
            student: { classId },
          },
          select: {
            id: true,
            date: true,
            status: true,
            notes: true,
            student: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { date: 'desc' },
          take: 40,
        }),
        prisma.result.findMany({
          where: {
            schoolId: classData.schoolId,
            student: { classId },
          },
          select: {
            id: true,
            term: true,
            year: true,
            totalScore: true,
            maxScore: true,
            grade: true,
            student: {
              select: { id: true, firstName: true, lastName: true },
            },
            subject: {
              select: { id: true, name: true, code: true },
            },
          },
          orderBy: [{ year: 'desc' }, { term: 'desc' }, { updatedAt: 'desc' }],
          take: 40,
        }),
      ])

    const teacherMap = new Map<
      string,
      {
        teacherId: string
        isHomeroom: boolean
        teacher: { id: string; firstName: string | null; lastName: string | null; email: string }
        subjects: Array<{ id: string; name: string; code: string | null; assignmentId: string }>
      }
    >()

    for (const row of assignments) {
      if (!teacherMap.has(row.teacherId)) {
        teacherMap.set(row.teacherId, {
          teacherId: row.teacherId,
          isHomeroom: classData.teacherId === row.teacherId,
          teacher: row.teacher,
          subjects: [],
        })
      }
      teacherMap.get(row.teacherId)!.subjects.push({
        id: row.subject.id,
        name: row.subject.name,
        code: row.subject.code,
        assignmentId: row.id,
      })
    }

    if (classData.teacher && !teacherMap.has(classData.teacher.id)) {
      teacherMap.set(classData.teacher.id, {
        teacherId: classData.teacher.id,
        isHomeroom: true,
        teacher: classData.teacher,
        subjects: [],
      })
    }

    const teachers = Array.from(teacherMap.values()).sort((a, b) => {
      if (a.isHomeroom !== b.isHomeroom) return a.isHomeroom ? -1 : 1
      const aName = `${a.teacher.lastName || ''} ${a.teacher.firstName || ''}`.trim()
      const bName = `${b.teacher.lastName || ''} ${b.teacher.firstName || ''}`.trim()
      return aName.localeCompare(bName)
    })

    const students = [
      ...primaryStudents.map((s) => ({ ...s, enrollmentType: 'primary' as const })),
      ...additionalEnrollments.map(({ student }) => ({
        ...student,
        enrollmentType: 'additional' as const,
      })),
    ]

    const attendanceSummary = attendanceByStatus.reduce(
      (acc, row) => {
        if (row.status === 'PRESENT') acc.present = row._count._all
        if (row.status === 'ABSENT') acc.absent = row._count._all
        if (row.status === 'LATE') acc.late = row._count._all
        return acc
      },
      { present: 0, absent: 0, late: 0 }
    )

    const attendanceTotal =
      attendanceSummary.present + attendanceSummary.absent + attendanceSummary.late
    const attendanceRate =
      attendanceTotal > 0
        ? Number((((attendanceSummary.present + attendanceSummary.late) / attendanceTotal) * 100).toFixed(1))
        : null

    const scored = results.filter((r) => typeof r.totalScore === 'number' && r.maxScore > 0)
    const averageScore =
      scored.length > 0
        ? Number(
            (
              scored.reduce((sum, r) => sum + ((r.totalScore as number) / r.maxScore) * 100, 0) /
              scored.length
            ).toFixed(1)
          )
        : null

    return NextResponse.json({
      class: {
        id: classData.id,
        name: classData.name,
        grade: classData.grade,
        capacity: classData.capacity,
        academicYear: classData.academicYearRecord?.year ?? classData.academicYear,
        academicYearId: classData.academicYearRecord?.id ?? classData.academicYearId,
        academicYearName: classData.academicYearRecord?.name ?? null,
        teacherId: classData.teacherId,
        teacher: classData.teacher,
        studentCount: students.length,
        subjectCount: classData._count.subjectAssignments,
        teacherCount: teachers.length,
      },
      summary: {
        studentCount: students.length,
        teacherCount: teachers.length,
        subjectCount: classData._count.subjectAssignments,
        attendanceRate,
        attendanceSummary,
        averageScore,
      },
      teachers,
      students,
      recentAttendance,
      results,
    })
  } catch (error) {
    console.error('Error fetching class overview:', error)
    return NextResponse.json({ error: 'Failed to fetch class overview' }, { status: 500 })
  }
}
