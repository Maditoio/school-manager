import { prisma } from '@/lib/prisma'

export class CurrentTermNotSetError extends Error {
  constructor() {
    super('No current term is configured for this school. Ask admin to set a current term.')
    this.name = 'CurrentTermNotSetError'
  }
}

export class TermLockedError extends Error {
  constructor(termName?: string) {
    super(termName ? `${termName} is locked. This record cannot be modified.` : 'Term is locked. This record cannot be modified.')
    this.name = 'TermLockedError'
  }
}

export async function getCurrentTermForSchool(schoolId: string) {
  const term = await prisma.terms.findFirst({
    where: {
      school_id: schoolId,
      is_current: true,
    },
    include: {
      academic_years: {
        select: {
          year: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  })

  if (!term) {
    throw new CurrentTermNotSetError()
  }

  return {
    id: term.id,
    schoolId: term.school_id,
    name: term.name,
    startDate: term.start_date,
    endDate: term.end_date,
    isCurrent: term.is_current,
    isLocked: term.is_locked,
    academicYear: {
      year: term.academic_years.year,
    },
  }
}

export async function getCurrentEditableTermForSchool(schoolId: string) {
  const term = await getCurrentTermForSchool(schoolId)
  if (term.isLocked) {
    throw new TermLockedError(term.name)
  }
  return term
}

export async function assertTermEditableById(params: { schoolId: string; termId?: string | null }) {
  if (!params.termId) return

  const term = await prisma.terms.findFirst({
    where: {
      id: params.termId,
      school_id: params.schoolId,
    },
    select: {
      is_locked: true,
      name: true,
    },
  })

  if (term?.is_locked) {
    throw new TermLockedError(term.name)
  }
}

export async function assertTermEditableByLegacyValues(params: {
  schoolId: string
  termName?: string | null
  academicYear?: number | null
}) {
  if (!params.termName || !params.academicYear) return

  const term = await prisma.terms.findFirst({
    where: {
      school_id: params.schoolId,
      name: params.termName,
    },
    include: {
      academic_years: {
        select: {
          year: true,
        },
      },
    },
  })

  if (!term) return
  if (term.academic_years.year !== params.academicYear) return

  if (term.is_locked) {
    throw new TermLockedError(term.name)
  }
}
