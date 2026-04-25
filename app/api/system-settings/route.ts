import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isMissingGlobalSystemSettingsTable, isMissingVideoCoursesEnabledColumn } from '@/lib/video-courses-feature'

async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    return null
  }
  return session
}

// GET /api/system-settings
export async function GET() {
  try {
    const session = await requireSuperAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
      const settings = await prisma.globalSystemSettings.findUnique({
        where: { key: 'GLOBAL' },
      })

      return NextResponse.json({
        videoCoursesGloballyEnabled: settings?.videoCoursesGloballyEnabled ?? true,
      })
    } catch (error) {
      if (isMissingGlobalSystemSettingsTable(error)) {
        return NextResponse.json({ videoCoursesGloballyEnabled: true })
      }
      throw error
    }
  } catch (error) {
    console.error('Error fetching system settings:', error)
    return NextResponse.json({ error: 'Failed to fetch system settings' }, { status: 500 })
  }
}

// PATCH /api/system-settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSuperAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    if (typeof body.videoCoursesGloballyEnabled !== 'boolean') {
      return NextResponse.json({ error: 'videoCoursesGloballyEnabled must be a boolean' }, { status: 400 })
    }

    const enabled = Boolean(body.videoCoursesGloballyEnabled)

    try {
      await prisma.globalSystemSettings.upsert({
        where: { key: 'GLOBAL' },
        create: { key: 'GLOBAL', videoCoursesGloballyEnabled: enabled },
        update: { videoCoursesGloballyEnabled: enabled },
      })
    } catch (error) {
      if (!isMissingGlobalSystemSettingsTable(error)) throw error
      // If table is not available yet, we still continue with school-level update below.
    }

    // Apply this toggle to all schools to satisfy platform-wide enable/disable behavior.
    try {
      await prisma.schoolSettings.updateMany({
        data: { videoCoursesEnabled: enabled },
      })
    } catch (error) {
      if (!isMissingVideoCoursesEnabledColumn(error)) throw error
    }

    return NextResponse.json({ videoCoursesGloballyEnabled: enabled })
  } catch (error) {
    console.error('Error updating system settings:', error)
    return NextResponse.json({ error: 'Failed to update system settings' }, { status: 500 })
  }
}
