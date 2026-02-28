import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

function resolveSchoolId(
  sessionUser: { role: string; schoolId?: string | null },
  providedSchoolId?: string | null
) {
  if (sessionUser.role === 'SUPER_ADMIN') {
    return providedSchoolId || null
  }
  return sessionUser.schoolId || null
}

// GET /api/terms - list academic years and terms for a school
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestedSchoolId = searchParams.get('schoolId')
    const schoolId = resolveSchoolId(session.user, requestedSchoolId)

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const academicYears = await prisma.academicYear.findMany({
      where: { schoolId },
      include: {
        terms: {
          orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    })

    const currentTerm = academicYears
      .flatMap((academicYear) => academicYear.terms.map((term) => ({ ...term, academicYear })))
      .find((term) => term.isCurrent)

    return NextResponse.json({
      academicYears,
      currentTerm: currentTerm || null,
    })
  } catch (error) {
    console.error('Error fetching terms:', error)
    return NextResponse.json({ error: 'Failed to fetch terms' }, { status: 500 })
  }
}

// POST /api/terms - create academic year, create term, set current term
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const action = typeof body?.action === 'string' ? body.action : ''
    const schoolId = resolveSchoolId(session.user, body?.schoolId)

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    if (action === 'createAcademicYear') {
      const parsedYear = Number(body?.year)
      if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        return NextResponse.json({ error: 'Invalid academic year' }, { status: 400 })
      }

      const academicYear = await prisma.academicYear.upsert({
        where: {
          schoolId_year: {
            schoolId,
            year: parsedYear,
          },
        },
        update: {
          name: body?.name?.trim() || `Academic Year ${parsedYear}`,
        },
        create: {
          schoolId,
          year: parsedYear,
          name: body?.name?.trim() || `Academic Year ${parsedYear}`,
        },
      })

      return NextResponse.json({ academicYear }, { status: 201 })
    }

    if (action === 'createTerm') {
      const academicYearId = typeof body?.academicYearId === 'string' ? body.academicYearId : ''
      const name = typeof body?.name === 'string' ? body.name.trim() : ''
      const startDate = body?.startDate ? new Date(body.startDate) : null
      const endDate = body?.endDate ? new Date(body.endDate) : null
      const isCurrent = body?.isCurrent === true

      if (!academicYearId || !name || !startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'academicYearId, name, startDate and endDate are required' }, { status: 400 })
      }

      const academicYear = await prisma.academicYear.findFirst({
        where: { id: academicYearId, schoolId },
      })

      if (!academicYear) {
        return NextResponse.json({ error: 'Academic year not found' }, { status: 404 })
      }

      if (isCurrent) {
        await prisma.term.updateMany({
          where: { schoolId },
          data: { isCurrent: false },
        })
      }

      const term = await prisma.term.create({
        data: {
          schoolId,
          academicYearId,
          name,
          startDate,
          endDate,
          isCurrent,
          isLocked: false,
        },
      })

      return NextResponse.json({ term }, { status: 201 })
    }

    if (action === 'setCurrentTerm') {
      const termId = typeof body?.termId === 'string' ? body.termId : ''
      if (!termId) {
        return NextResponse.json({ error: 'termId is required' }, { status: 400 })
      }

      const targetTerm = await prisma.term.findFirst({
        where: {
          id: termId,
          schoolId,
        },
        select: { id: true },
      })

      if (!targetTerm) {
        return NextResponse.json({ error: 'Term not found' }, { status: 404 })
      }

      await prisma.$transaction([
        prisma.term.updateMany({
          where: { schoolId },
          data: { isCurrent: false },
        }),
        prisma.term.update({
          where: { id: termId },
          data: { isCurrent: true },
        }),
      ])

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error handling terms request:', error)
    return NextResponse.json({ error: 'Failed to process terms request' }, { status: 500 })
  }
}
