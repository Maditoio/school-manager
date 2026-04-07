import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasRole } from "@/lib/auth-utils"
import { assertTermEditableById, assertTermEditableByLegacyValues, TermLockedError } from '@/lib/term-utils'
import { enqueueAcademicAggregation, processAcademicAggregationEvents } from '@/lib/academic-aggregation'
import { invalidateSchoolAdminCachedStats } from '@/lib/dashboard-cache'

// GET /api/results/[id] - Get result details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: resultId } = await params

    const result = await prisma.result.findUnique({
      where: { id: resultId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    if (!result) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 })
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Error fetching result:', error)
    return NextResponse.json(
      { error: 'Failed to fetch result' },
      { status: 500 }
    )
  }
}

// PUT /api/results/[id] - Update result
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'TEACHER', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: resultId } = await params

    const existing = await prisma.result.findUnique({
      where: { id: resultId },
      select: {
        id: true,
        schoolId: true,
        termId: true,
        term: true,
        year: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 })
    }

    if (session.user.schoolId && existing.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let aggregationTermId = existing.termId
    if (!aggregationTermId) {
      const resolvedTerm = await prisma.terms.findFirst({
        where: {
          school_id: existing.schoolId,
          name: existing.term,
          academic_years: {
            is: {
              year: existing.year,
            },
          },
        },
        select: { id: true },
      })
      aggregationTermId = resolvedTerm?.id || null
    }

    await assertTermEditableById({ schoolId: existing.schoolId, termId: existing.termId })
    await assertTermEditableByLegacyValues({
      schoolId: existing.schoolId,
      termName: existing.term,
      academicYear: existing.year,
    })

    const result = await prisma.result.update({
      where: { id: resultId },
      data: {
        examType: body.examType,
        totalScore: body.totalScore,
        maxScore: body.maxScore,
        grade: body.grade,
        published: body.published,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    await enqueueAcademicAggregation({
      schoolId: existing.schoolId,
      termId: aggregationTermId,
    })
    void processAcademicAggregationEvents(1)
    invalidateSchoolAdminCachedStats(existing.schoolId)

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Error updating result:', error)
    if (error instanceof TermLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(
      { error: 'Failed to update result' },
      { status: 500 }
    )
  }
}

// DELETE /api/results/[id] - Delete result
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'TEACHER', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: resultId } = await params

    const existing = await prisma.result.findUnique({
      where: { id: resultId },
      select: {
        id: true,
        schoolId: true,
        termId: true,
        term: true,
        year: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 })
    }

    if (session.user.schoolId && existing.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let aggregationTermId = existing.termId
    if (!aggregationTermId) {
      const resolvedTerm = await prisma.terms.findFirst({
        where: {
          school_id: existing.schoolId,
          name: existing.term,
          academic_years: {
            is: {
              year: existing.year,
            },
          },
        },
        select: { id: true },
      })
      aggregationTermId = resolvedTerm?.id || null
    }

    await assertTermEditableById({ schoolId: existing.schoolId, termId: existing.termId })
    await assertTermEditableByLegacyValues({
      schoolId: existing.schoolId,
      termName: existing.term,
      academicYear: existing.year,
    })

    await prisma.result.delete({
      where: { id: resultId },
    })

    await enqueueAcademicAggregation({
      schoolId: existing.schoolId,
      termId: aggregationTermId,
    })
    void processAcademicAggregationEvents(1)
    invalidateSchoolAdminCachedStats(existing.schoolId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting result:', error)
    if (error instanceof TermLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(
      { error: 'Failed to delete result' },
      { status: 500 }
    )
  }
}
