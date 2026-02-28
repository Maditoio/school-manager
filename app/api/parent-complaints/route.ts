import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { parentComplaintSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const complaints = status
      ? await prisma.$queryRaw<Array<Record<string, unknown>>>
          `
            SELECT
              pc.id,
              pc.school_id AS "schoolId",
              pc.parent_id AS "parentId",
              pc.student_id AS "studentId",
              pc.subject,
              pc.description,
              pc.status,
              pc.resolved_at AS "resolvedAt",
              pc.created_at AS "createdAt",
              pc.updated_at AS "updatedAt",
              p.first_name AS "parentFirstName",
              p.last_name AS "parentLastName",
              p.email AS "parentEmail",
              s.first_name AS "studentFirstName",
              s.last_name AS "studentLastName",
              s.admission_number AS "studentAdmissionNumber"
            FROM parent_complaints pc
            LEFT JOIN users p ON p.id = pc.parent_id
            LEFT JOIN students s ON s.id = pc.student_id
            WHERE pc.school_id = ${session.user.schoolId}
              AND pc.status = ${status}
            ORDER BY pc.created_at DESC
          `
      : await prisma.$queryRaw<Array<Record<string, unknown>>>
          `
            SELECT
              pc.id,
              pc.school_id AS "schoolId",
              pc.parent_id AS "parentId",
              pc.student_id AS "studentId",
              pc.subject,
              pc.description,
              pc.status,
              pc.resolved_at AS "resolvedAt",
              pc.created_at AS "createdAt",
              pc.updated_at AS "updatedAt",
              p.first_name AS "parentFirstName",
              p.last_name AS "parentLastName",
              p.email AS "parentEmail",
              s.first_name AS "studentFirstName",
              s.last_name AS "studentLastName",
              s.admission_number AS "studentAdmissionNumber"
            FROM parent_complaints pc
            LEFT JOIN users p ON p.id = pc.parent_id
            LEFT JOIN students s ON s.id = pc.student_id
            WHERE pc.school_id = ${session.user.schoolId}
            ORDER BY pc.created_at DESC
          `

    return NextResponse.json({ complaints })
  } catch (error) {
    console.error('Error fetching parent complaints:', error)
    return NextResponse.json({ error: 'Failed to fetch parent complaints' }, { status: 500 })
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
    const validation = parentComplaintSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues }, { status: 400 })
    }

    const complaintId = randomUUID()
    const complaintStatus = validation.data.status || 'OPEN'

    await prisma.$executeRaw`
      INSERT INTO parent_complaints (
        id,
        school_id,
        parent_id,
        student_id,
        subject,
        description,
        status,
        created_at,
        updated_at
      ) VALUES (
        ${complaintId},
        ${session.user.schoolId},
        ${validation.data.parentId ?? null},
        ${validation.data.studentId ?? null},
        ${validation.data.subject},
        ${validation.data.description},
        ${complaintStatus},
        NOW(),
        NOW()
      )
    `

    const complaint = {
      id: complaintId,
      schoolId: session.user.schoolId,
      parentId: validation.data.parentId ?? null,
      studentId: validation.data.studentId ?? null,
      subject: validation.data.subject,
      description: validation.data.description,
      status: complaintStatus,
    }

    return NextResponse.json({ complaint }, { status: 201 })
  } catch (error) {
    console.error('Error creating parent complaint:', error)
    return NextResponse.json({ error: 'Failed to create parent complaint' }, { status: 500 })
  }
}
