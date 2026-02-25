import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

const SUPPORTED_LANGUAGES = ['en', 'fr', 'sw'] as const

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

function isMissingUserSettingsTableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021' || error.code === 'P2022') {
      return true
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('user_settings') && (message.includes('does not exist') || message.includes('not found'))
  }

  return false
}

function toSupportedLanguage(value: string | null | undefined): SupportedLanguage {
  return value && isSupportedLanguage(value) ? value : 'en'
}

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let preferredLanguage: SupportedLanguage = toSupportedLanguage(session.user.preferredLanguage)

    try {
      const userSettings = await prisma.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { preferredLanguage: true },
      })

      preferredLanguage = toSupportedLanguage(userSettings?.preferredLanguage)
    } catch (error) {
      if (!isMissingUserSettingsTableError(error)) {
        throw error
      }

      const fallbackUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { preferredLanguage: true },
      })

      preferredLanguage = toSupportedLanguage(fallbackUser?.preferredLanguage)
    }

    return NextResponse.json({
      preferredLanguage,
      supportedLanguages: SUPPORTED_LANGUAGES,
    })
  } catch (error) {
    console.error('Error fetching user preferences:', error)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const preferredLanguage = typeof body.preferredLanguage === 'string'
      ? body.preferredLanguage.trim().toLowerCase()
      : ''

    if (!isSupportedLanguage(preferredLanguage)) {
      return NextResponse.json(
        { error: 'Unsupported language' },
        { status: 400 }
      )
    }

    let savedLanguage: SupportedLanguage = preferredLanguage

    try {
      const settings = await prisma.userSettings.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          preferredLanguage,
        },
        update: { preferredLanguage },
        select: {
          preferredLanguage: true,
        },
      })

      savedLanguage = toSupportedLanguage(settings.preferredLanguage)
    } catch (error) {
      if (!isMissingUserSettingsTableError(error)) {
        throw error
      }

      const fallbackUser = await prisma.user.update({
        where: { id: session.user.id },
        data: { preferredLanguage },
        select: { preferredLanguage: true },
      })

      savedLanguage = toSupportedLanguage(fallbackUser.preferredLanguage)
    }

    return NextResponse.json({
      preferredLanguage: savedLanguage,
      supportedLanguages: SUPPORTED_LANGUAGES,
    })
  } catch (error) {
    console.error('Error updating user preferences:', error)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}
