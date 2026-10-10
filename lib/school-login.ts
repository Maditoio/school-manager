import { prisma } from '@/lib/prisma'

/** Normalize a school login code for storage and lookup. */
export function normalizeSchoolCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Build a globally unique student username from school code + admission number. */
export function buildStudentUsername(schoolCode: string, admissionNumber: string): string {
  const code = normalizeSchoolCode(schoolCode)
  const admission = admissionNumber.trim()
  return `${code}-${admission}`
}

export function schoolCodeFromName(name: string): string {
  const base = normalizeSchoolCode(name).slice(0, 8)
  return base || 'SCHOOL'
}

/** Allocate a unique school code, optionally preferring an explicit value. */
export async function allocateUniqueSchoolCode(options: {
  name: string
  preferredCode?: string | null
  excludeSchoolId?: string
}): Promise<string> {
  const preferred = options.preferredCode ? normalizeSchoolCode(options.preferredCode) : ''
  const base = (preferred || schoolCodeFromName(options.name)).slice(0, 10) || 'SCHOOL'

  let candidate = base
  let n = 1
  while (true) {
    const existing = await prisma.school.findFirst({
      where: {
        code: candidate,
        ...(options.excludeSchoolId ? { id: { not: options.excludeSchoolId } } : {}),
      },
      select: { id: true },
    })
    if (!existing) return candidate
    n += 1
    candidate = `${base.slice(0, 8)}${n}`
  }
}
