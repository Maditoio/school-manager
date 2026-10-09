import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { demoRequestSchema } from '@/lib/validations'

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_MAX = 5

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

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()

    // Silent success for honeypot fills (bots)
    if (typeof body?.website === 'string' && body.website.trim().length > 0) {
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    const validation = demoRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: validation.error.issues },
        { status: 400 }
      )
    }

    const { schoolName, contactName, email, message } = validation.data
    const phone = validation.data.phone?.trim() || null
    const role = validation.data.role?.trim() || null

    const demoRequest = await prisma.demoRequest.create({
      data: {
        schoolName,
        contactName,
        email: email.toLowerCase(),
        phone,
        role,
        message,
      },
      select: { id: true },
    })

    console.info('[demo-request]', {
      id: demoRequest.id,
      schoolName,
      email: email.toLowerCase(),
      role,
    })

    return NextResponse.json({ ok: true, id: demoRequest.id }, { status: 201 })
  } catch (error) {
    console.error('Error creating demo request:', error)
    return NextResponse.json({ error: 'Failed to submit demo request' }, { status: 500 })
  }
}
