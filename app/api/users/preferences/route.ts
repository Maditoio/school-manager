import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const SUPPORTED_LANGUAGES = ['en', 'fr', 'sw'] as const

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      preferredLanguage: session.user.preferredLanguage || 'en',
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

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { preferredLanguage },
      select: {
        id: true,
        preferredLanguage: true,
      },
    })

    return NextResponse.json({
      user: updatedUser,
      supportedLanguages: SUPPORTED_LANGUAGES,
    })
  } catch (error) {
    console.error('Error updating user preferences:', error)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}
