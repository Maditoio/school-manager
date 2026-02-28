import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { teacherContractSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const contracts = await prisma.$queryRaw<Array<{
      id: string
      schoolId: string
      teacherId: string
      title: string | null
      startDate: Date
      endDate: Date
      status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED'
      notes: string | null
      createdAt: Date
      updatedAt: Date
      teacherFirstName: string | null
      teacherLastName: string | null
      teacherEmail: string
    }>>`
      SELECT
        tc.id,
        tc.school_id AS "schoolId",
        tc.teacher_id AS "teacherId",
        tc.title,
        tc.start_date AS "startDate",
        tc.end_date AS "endDate",
        tc.status,
        tc.notes,
        tc.created_at AS "createdAt",
        tc.updated_at AS "updatedAt",
        u.first_name AS "teacherFirstName",
        u.last_name AS "teacherLastName",
        u.email AS "teacherEmail"
      FROM teacher_contracts tc
      JOIN users u ON u.id = tc.teacher_id
      WHERE tc.school_id = ${session.user.schoolId}
      ORDER BY tc.end_date ASC, tc.created_at DESC
    `

    return NextResponse.json({ contracts })
  } catch (error) {
    console.error('Error fetching teacher contracts:', error)
    return NextResponse.json({ error: 'Failed to fetch teacher contracts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const body = await request.json()
    const validation = teacherContractSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues }, { status: 400 })
    }

    const { teacherId, title, startDate, endDate, status, notes } = validation.data

    const teacher = await prisma.user.findFirst({
      where: {
        id: teacherId,
        schoolId: session.user.schoolId,
        role: 'TEACHER',
      },
      select: { id: true },
    })

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
    }

    const id = randomUUID()
    const startAt = new Date(startDate)
    const endAt = new Date(endDate)

    await prisma.$executeRaw`
      INSERT INTO teacher_contracts (
        id,
        school_id,
        teacher_id,
        title,
        start_date,
        end_date,
        status,
        notes,
        created_at,
        updated_at
      ) VALUES (
        ${id},
        ${session.user.schoolId},
        ${teacherId},
        ${title ?? null},
        ${startAt},
        ${endAt},
        ${status || 'ACTIVE'},
        ${notes ?? null},
        NOW(),
        NOW()
      )
    `

    const contract = {
      id,
      schoolId: session.user.schoolId,
      teacherId,
      title: title ?? null,
      startDate: startAt,
      endDate: endAt,
      status: status || 'ACTIVE',
      notes: notes ?? null,
    }

    return NextResponse.json({ contract }, { status: 201 })
  } catch (error) {
    console.error('Error creating teacher contract:', error)
    return NextResponse.json({ error: 'Failed to create teacher contract' }, { status: 500 })
  }
}
