/** Default Prisma order for student lists: admission number ascending. */
export const STUDENT_LIST_ORDER_BY = [
  { admissionNumber: 'asc' as const },
  { lastName: 'asc' as const },
  { firstName: 'asc' as const },
]

type AdmissionSortable = {
  admissionNumber?: string | null
  lastName?: string | null
  firstName?: string | null
}

/** Numeric-aware admission sort for in-memory lists (nulls last). */
export function compareStudentsByAdmissionNumber(a: AdmissionSortable, b: AdmissionSortable): number {
  const aAdm = a.admissionNumber?.trim() || ''
  const bAdm = b.admissionNumber?.trim() || ''

  if (!aAdm && !bAdm) {
    const aName = `${a.lastName || ''} ${a.firstName || ''}`.trim()
    const bName = `${b.lastName || ''} ${b.firstName || ''}`.trim()
    return aName.localeCompare(bName, undefined, { sensitivity: 'base' })
  }
  if (!aAdm) return 1
  if (!bAdm) return -1

  const byAdmission = aAdm.localeCompare(bAdm, undefined, { numeric: true, sensitivity: 'base' })
  if (byAdmission !== 0) return byAdmission

  const aName = `${a.lastName || ''} ${a.firstName || ''}`.trim()
  const bName = `${b.lastName || ''} ${b.firstName || ''}`.trim()
  return aName.localeCompare(bName, undefined, { sensitivity: 'base' })
}
