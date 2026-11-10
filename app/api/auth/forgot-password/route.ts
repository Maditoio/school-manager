import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { isSystemEmail } from '@/lib/teacher-login'

/** Temporary password after forgot-password reset; must change on next login. */
const DEFAULT_USER_PASSWORD = 'default12345'

const CONTACT_ADMIN_MESSAGE =
  'Password reset is only available for email accounts. Students and teachers who sign in with a student number or phone should contact their school administrator.'

const SUCCESS_MESSAGE =
  'If an account with that email exists, you can sign in with the temporary password default12345. You will be asked to change it after signing in.'

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 8

type RateBucket = { count: number; resetAt: number }
const rateBuckets = new Map<string, RateBucket>()

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)

  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    return true
  }

  bucket.count += 1
  return false
}

function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed.includes('@')) return false
  // Basic shape check — rejects phone numbers and admission numbers
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

function isEligibleEmailAccount(email: string): boolean {
  if (!email.includes('@')) return false
  if (isSystemEmail(email)) return false
  return true
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const rawEmail = typeof body.email === 'string' ? body.email.trim() : ''

    if (!rawEmail || !looksLikeEmail(rawEmail)) {
      return NextResponse.json({ error: CONTACT_ADMIN_MESSAGE }, { status: 400 })
    }

    const normalizedEmail = rawEmail.toLowerCase()

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true, email: true },
    })

    if (user && !isEligibleEmailAccount(user.email)) {
      return NextResponse.json({ error: CONTACT_ADMIN_MESSAGE }, { status: 400 })
    }

    if (user && isEligibleEmailAccount(user.email)) {
      const hashedPassword = await hash(DEFAULT_USER_PASSWORD, 12)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          mustResetPassword: true,
        },
      })
    }

    // Same success copy whether or not the email exists (eligible resets only when found)
    return NextResponse.json({
      success: true,
      message: SUCCESS_MESSAGE,
      temporaryPassword: DEFAULT_USER_PASSWORD,
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Failed to process password reset. Please try again.' },
      { status: 500 }
    )
  }
}
