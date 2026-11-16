import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { deleteStudentCompletely, StudentDeleteError } from '@/lib/delete-student'

const MAX_BULK_DELETE = 100

// POST /api/students/bulk-delete — permanently delete multiple students from the school
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as { ids?: unknown } | null
    const rawIds = Array.isArray(body?.ids) ? body.ids : []
    const ids: string[] = [
      ...new Set(
        rawIds
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      ),
    ]

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Select at least one student' }, { status: 400 })
    }

    if (ids.length > MAX_BULK_DELETE) {
      return NextResponse.json(
        { error: `You can delete at most ${MAX_BULK_DELETE} students at once` },
        { status: 400 }
      )
    }

    const schoolId = session.user.schoolId
    const deleted: Array<{ id: string; name: string }> = []
    const failed: Array<{ id: string; error: string }> = []

    for (const studentId of ids) {
      try {
        const result = await prisma.$transaction(async (tx) =>
          deleteStudentCompletely(tx, { studentId, schoolId })
        )
        deleted.push({ id: result.id, name: result.name })
      } catch (error) {
        failed.push({
          id: studentId,
          error:
            error instanceof StudentDeleteError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Failed to delete student',
        })
      }
    }

    return NextResponse.json({
      success: failed.length === 0,
      deletedCount: deleted.length,
      failedCount: failed.length,
      deleted,
      failed,
    })
  } catch (error) {
    console.error('Error bulk-deleting students:', error)
    return NextResponse.json({ error: 'Failed to delete students' }, { status: 500 })
  }
}
