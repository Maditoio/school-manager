import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

export async function PUT(
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

    const { id } = await params
    const body = await request.json()

    if (!body.startDate || !body.endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM teacher_contracts
      WHERE id = ${id}
        AND school_id = ${session.user.schoolId}
      LIMIT 1
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    await prisma.$executeRaw`
      UPDATE teacher_contracts
      SET
        title = ${body.title ?? null},
        start_date = ${new Date(body.startDate)}::date,
        end_date = ${new Date(body.endDate)}::date,
        status = ${body.status || 'ACTIVE'}::"TeacherContractStatus",
        notes = ${body.notes ?? null},
        updated_at = NOW()
      WHERE id = ${id}
        AND school_id = ${session.user.schoolId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating teacher contract:', error)
    return NextResponse.json({ error: 'Failed to update teacher contract' }, { status: 500 })
  }
}
