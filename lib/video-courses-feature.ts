import { prisma } from '@/lib/prisma'

type PrismaLikeError = {
  code?: string
  message?: string
}

export function isMissingVideoCoursesEnabledColumn(error: unknown) {
  const candidate = error as PrismaLikeError | null
  if (!candidate) return false

  return (
    candidate.code === 'P2022' &&
    String(candidate.message ?? '').includes('video_courses_enabled')
  )
}

export function isMissingGlobalSystemSettingsTable(error: unknown) {
  const candidate = error as PrismaLikeError | null
  if (!candidate) return false

  return candidate.code === 'P2021' && String(candidate.message ?? '').includes('global_system_settings')
}

export async function getVideoCoursesEnabledForSchool(schoolId: string) {
  try {
    const globalSettings = await prisma.globalSystemSettings.findUnique({
      where: { key: 'GLOBAL' },
      select: { videoCoursesGloballyEnabled: true },
    })

    if (globalSettings?.videoCoursesGloballyEnabled === false) {
      return false
    }
  } catch (error) {
    // Backward-compatibility: table may not exist yet in older DBs.
    if (!isMissingGlobalSystemSettingsTable(error)) throw error
  }

  try {
    const settings = await prisma.schoolSettings.findUnique({
      where: { schoolId },
      select: { videoCoursesEnabled: true },
    })
    return settings?.videoCoursesEnabled !== false
  } catch (error) {
    // Backward-compatibility: older DBs may not have this column yet.
    if (isMissingVideoCoursesEnabledColumn(error)) return true
    throw error
  }
}
