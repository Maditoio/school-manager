import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { Prisma } from '@prisma/client'

const ALLOWED_STATUSES = new Set(['ACTIVE', 'LEFT'])
const ALLOWED_REASONS = new Set(['SUSPENSION', 'GRADUATION', 'TRANSFERRED_SCHOOL', 'OTHER'])

function getErrorDetails(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      type: 'PrismaClientKnownRequestError',
      code: error.code,
      message: error.message,
      meta: error.meta,
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      type: 'PrismaClientValidationError',
      message: error.message,
    }
  }

  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }
  }

  return {
    type: 'UnknownError',
    message: String(error),
  }
}

async function verifyStatusSchema() {
  const checks = await prisma.$queryRaw<Array<{ missing_count: bigint }>>`
    SELECT COUNT(*)::bigint AS missing_count
    FROM (
      SELECT 'status' AS column_name
      UNION ALL SELECT 'status_reason'
      UNION ALL SELECT 'status_date'
      UNION ALL SELECT 'status_notes'
    ) required_columns
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public'
      AND c.table_name = 'students'
      AND c.column_name = required_columns.column_name
    WHERE c.column_name IS NULL
  `

  const missingCount = Number(checks[0]?.missing_count || 0)
  if (missingCount > 0) {
    return {
      ok: false,
      message: 'Missing one or more status columns on students table',
    }
  }

  const historyTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'student_status_history'
    ) AS exists
  `

  if (!historyTable[0]?.exists) {
    return {
      ok: false,
      message: 'Missing student_status_history table',
    }
  }

  return { ok: true }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID()

  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { id: studentId } = await params

    const schemaState = await verifyStatusSchema()
    if (!schemaState.ok) {
      console.error('Status update schema check failed', {
        requestId,
        studentId,
        schemaMessage: schemaState.message,
      })

      return NextResponse.json(
        {
          error: 'Database schema mismatch for student status updates.',
          details: schemaState.message,
          requestId,
          fix: 'Run `npx prisma db push` and restart the Next.js server.',
        },
        { status: 500 }
      )
    }

    const status = typeof body.status === 'string' ? body.status.toUpperCase() : ''
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const reason =
      typeof body.reason === 'string' && body.reason.trim().length > 0
        ? body.reason.trim().toUpperCase()
        : null

    if (status === 'LEFT' && !reason) {
      return NextResponse.json(
        { error: 'Reason is required when marking a student as left' },
        { status: 400 }
      )
    }

    if (reason && !ALLOWED_REASONS.has(reason)) {
      return NextResponse.json({ error: 'Invalid reason' }, { status: 400 })
    }

    const effectiveAtRaw = typeof body.effectiveAt === 'string' ? body.effectiveAt : ''
    const parsedEffectiveAt = effectiveAtRaw ? new Date(effectiveAtRaw) : new Date()

    if (Number.isNaN(parsedEffectiveAt.getTime())) {
      return NextResponse.json({ error: 'Invalid effective date' }, { status: 400 })
    }

    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

    const existingStudentRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM students
      WHERE id = ${studentId}
      ${session.user.schoolId ? Prisma.sql`AND school_id = ${session.user.schoolId}` : Prisma.empty}
      LIMIT 1
    `

    const existingStudent = existingStudentRows[0]

    if (!existingStudent) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const normalizedReason = status === 'LEFT' ? reason : null

    const historyId = crypto.randomUUID()

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE students
        SET
          status = ${status}::"StudentEnrollmentStatus",
          status_reason = ${normalizedReason}::"StudentLeaveReason",
          status_date = ${parsedEffectiveAt},
          status_notes = ${notes || null},
          updated_at = NOW()
        WHERE id = ${studentId}
      `

      await tx.$executeRaw`
        INSERT INTO student_status_history
          (id, student_id, status, reason, effective_at, notes, changed_by_id, created_at)
        VALUES
          (
            ${historyId}::uuid,
            ${studentId},
            ${status}::"StudentEnrollmentStatus",
            ${normalizedReason}::"StudentLeaveReason",
            ${parsedEffectiveAt},
            ${notes || null},
            ${session.user.id},
            NOW()
          )
      `
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const details = getErrorDetails(error)
    console.error('Error updating student status', {
      requestId,
      details,
    })

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2021' || error.code === 'P2022') {
        return NextResponse.json(
          {
            error: 'Database schema is out of sync for student status updates.',
            details: error.message,
            requestId,
            fix: 'Run `npx prisma db push` and restart the Next.js server.',
          },
          { status: 500 }
        )
      }

      if (error.code === 'P2003') {
        return NextResponse.json(
          {
            error: 'Status update failed due to related record constraint.',
            details: error.message,
            requestId,
          },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to update student status',
        details: details.message,
        requestId,
      },
      { status: 500 }
    )
  }
}
