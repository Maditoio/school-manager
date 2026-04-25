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

export async function getVideoCoursesEnabledForSchool(schoolId: string) {
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
