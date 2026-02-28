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

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const { id } = await params
    const body = await request.json()
    const nextStatus = body.status || 'OPEN'
    const resolvedAt = nextStatus === 'RESOLVED' || nextStatus === 'CLOSED' ? new Date() : null

    const updated = await prisma.$executeRaw`
      UPDATE parent_complaints
      SET
        subject = COALESCE(${body.subject ?? null}, subject),
        description = COALESCE(${body.description ?? null}, description),
        status = ${nextStatus}::"ParentComplaintStatus",
        resolved_at = ${resolvedAt},
        updated_at = NOW()
      WHERE id = ${id}
        AND school_id = ${session.user.schoolId}
    `

    if (updated === 0) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating parent complaint:', error)
    return NextResponse.json({ error: 'Failed to update parent complaint' }, { status: 500 })
  }
}
