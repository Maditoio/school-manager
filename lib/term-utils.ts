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
  const term = await prisma.term.findFirst({
    where: {
      schoolId,
      isCurrent: true,
    },
    include: {
      academicYear: {
        select: {
          year: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!term) {
    throw new CurrentTermNotSetError()
  }

  return term
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

  const term = await prisma.term.findFirst({
    where: {
      id: params.termId,
      schoolId: params.schoolId,
    },
    select: {
      isLocked: true,
      name: true,
    },
  })

  if (term?.isLocked) {
    throw new TermLockedError(term.name)
  }
}

export async function assertTermEditableByLegacyValues(params: {
  schoolId: string
  termName?: string | null
  academicYear?: number | null
}) {
  if (!params.termName || !params.academicYear) return

  const term = await prisma.term.findFirst({
    where: {
      schoolId: params.schoolId,
      name: params.termName,
    },
    include: {
      academicYear: {
        select: {
          year: true,
        },
      },
    },
  })

  if (!term) return
  if (term.academicYear.year !== params.academicYear) return

  if (term.isLocked) {
    throw new TermLockedError(term.name)
  }
}
