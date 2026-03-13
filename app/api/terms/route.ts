import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { randomUUID } from 'crypto'

function normalizeTerm(term: {
  id: string
  name: string
  academic_year_id: string
  start_date: Date
  end_date: Date
  is_current: boolean
  is_locked: boolean
  created_at?: Date
}) {
  return {
    id: term.id,
    name: term.name,
    academicYearId: term.academic_year_id,
    startDate: term.start_date,
    endDate: term.end_date,
    isCurrent: term.is_current,
    isLocked: term.is_locked,
    createdAt: term.created_at,
  }
}

function normalizeAcademicYear(academicYear: {
  id: string
  year: number
  name: string
  is_current: boolean
  terms: Array<{
    id: string
    name: string
    academic_year_id: string
    start_date: Date
    end_date: Date
    is_current: boolean
    is_locked: boolean
    created_at?: Date
  }>
}) {
  return {
    id: academicYear.id,
    year: academicYear.year,
    name: academicYear.name,
    isCurrent: academicYear.is_current,
    terms: academicYear.terms.map(normalizeTerm),
  }
}

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

    const academicYears = await prisma.academic_years.findMany({
      where: { school_id: schoolId },
      include: {
        terms: {
          orderBy: [{ start_date: 'asc' }, { created_at: 'asc' }],
        },
      },
      orderBy: [{ year: 'desc' }, { created_at: 'desc' }],
    })

    const normalizedAcademicYears = academicYears.map(normalizeAcademicYear)

    const currentTerm = normalizedAcademicYears
      .flatMap((academicYear) => academicYear.terms.map((term) => ({ ...term, academicYear })))
      .find((term) => term.isCurrent)

    return NextResponse.json({
      academicYears: normalizedAcademicYears,
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

      const academicYear = await prisma.academic_years.upsert({
        where: {
          school_id_year: {
            school_id: schoolId,
            year: parsedYear,
          },
        },
        update: {
          name: body?.name?.trim() || `Academic Year ${parsedYear}`,
          updated_at: new Date(),
        },
        create: {
          id: randomUUID(),
          school_id: schoolId,
          year: parsedYear,
          name: body?.name?.trim() || `Academic Year ${parsedYear}`,
          updated_at: new Date(),
        },
      })

      return NextResponse.json({
        academicYear: {
          id: academicYear.id,
          year: academicYear.year,
          name: academicYear.name,
          isCurrent: academicYear.is_current,
        },
      }, { status: 201 })
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

      const academicYear = await prisma.academic_years.findFirst({
        where: { id: academicYearId, school_id: schoolId },
      })

      if (!academicYear) {
        return NextResponse.json({ error: 'Academic year not found' }, { status: 404 })
      }

      if (isCurrent) {
        await prisma.terms.updateMany({
          where: { school_id: schoolId },
          data: { is_current: false },
        })
      }

      const term = await prisma.terms.create({
        data: {
          id: randomUUID(),
          school_id: schoolId,
          academic_year_id: academicYearId,
          name,
          start_date: startDate,
          end_date: endDate,
          is_current: isCurrent,
          is_locked: false,
        },
      })

      return NextResponse.json({ term: normalizeTerm(term) }, { status: 201 })
    }

    if (action === 'setCurrentTerm') {
      const termId = typeof body?.termId === 'string' ? body.termId : ''
      if (!termId) {
        return NextResponse.json({ error: 'termId is required' }, { status: 400 })
      }

      const targetTerm = await prisma.terms.findFirst({
        where: {
          id: termId,
          school_id: schoolId,
        },
        select: { id: true },
      })

      if (!targetTerm) {
        return NextResponse.json({ error: 'Term not found' }, { status: 404 })
      }

      await prisma.$transaction([
        prisma.terms.updateMany({
          where: { school_id: schoolId },
          data: { is_current: false },
        }),
        prisma.terms.update({
          where: { id: termId },
          data: { is_current: true },
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
