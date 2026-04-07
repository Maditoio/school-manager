import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const { id: teacherId } = await params

    const teacher = await prisma.user.findFirst({
      where: {
        id: teacherId,
        schoolId: session.user.schoolId,
        role: 'TEACHER',
      },
      select: {
        id: true,
        title: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    })

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
    }

    const [contracts, offDays, subjects, studentLoadRows] = await Promise.all([
      prisma.$queryRaw<Array<{
        id: string
        title: string | null
        start_date: Date
        end_date: Date
        status: string
        notes: string | null
      }>>`
        SELECT id, title, start_date, end_date, status, notes
        FROM teacher_contracts
        WHERE teacher_id = ${teacherId}
          AND school_id = ${session.user.schoolId}
        ORDER BY end_date DESC
      `,
      prisma.$queryRaw<Array<{
        id: string
        start_date: Date
        end_date: Date
        reason: string | null
      }>>`
        SELECT id, start_date, end_date, reason
        FROM teacher_off_days
        WHERE teacher_id = ${teacherId}
          AND school_id = ${session.user.schoolId}
        ORDER BY start_date DESC
      `,
      prisma.$queryRaw<Array<{
        class_name: string
        subject_name: string
        subject_code: string | null
      }>>`
        SELECT
          c.name AS class_name,
          s.name AS subject_name,
          s.code AS subject_code
        FROM class_subject_teachers cst
        JOIN classes c ON c.id = cst.class_id
        JOIN subjects s ON s.id = cst.subject_id
        WHERE cst.teacher_id = ${teacherId}
          AND cst.school_id = ${session.user.schoolId}
        ORDER BY c.name ASC, s.name ASC
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT s.id)::bigint AS count
        FROM students s
        JOIN classes c ON c.id = s.class_id
        LEFT JOIN class_subject_teachers cst ON cst.class_id = c.id
        WHERE c.school_id = ${session.user.schoolId}
          AND (
            c.teacher_id = ${teacherId}
            OR cst.teacher_id = ${teacherId}
          )
      `,
    ])

    const activeContract = contracts.find((contract) => contract.status === 'ACTIVE') || null
    const today = new Date()
    const activeOffDay = offDays.find((offDay) => {
      const start = new Date(offDay.start_date)
      const end = new Date(offDay.end_date)
      return start <= today && end >= today
    }) || null

    const payload = {
      teacher,
      summary: {
        activeContract,
        activeOffDay,
        totalContracts: contracts.length,
        totalOffDays: offDays.length,
        totalSubjects: subjects.length,
        totalStudentsTaught: Number(studentLoadRows[0]?.count || 0),
      },
      contracts,
      offDays,
      subjects,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error fetching teacher profile:', error)
    return NextResponse.json({ error: 'Failed to fetch teacher profile' }, { status: 500 })
  }
}
