import { put, del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

async function resolveSchoolId(sessionUser: { email?: string | null; schoolId?: string | null }) {
  if (sessionUser.schoolId) return sessionUser.schoolId
  if (!sessionUser.email) return null
  const user = await prisma.user.findUnique({
    where: { email: sessionUser.email.toLowerCase() },
    select: { schoolId: true },
  })
  return user?.schoolId ?? null
}

// POST /api/schools/logo — upload school logo to Vercel Blob
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const schoolId = await resolveSchoolId(session.user)
    if (!schoolId) return NextResponse.json({ error: 'School not found' }, { status: 400 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Use PNG, JPEG, GIF, WebP or SVG.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum size is 2 MB.' }, { status: 400 })
    }

    // Best-effort delete the old blob to avoid orphaned files
    const existing = await prisma.schoolSettings.findUnique({
      where: { schoolId },
      select: { logoUrl: true },
    })
    if (existing?.logoUrl && /^https:\/\/.+\.blob\.vercel-storage\.com/i.test(existing.logoUrl)) {
      try { await del(existing.logoUrl) } catch { /* ignore — old blob may already be gone */ }
    }

    // Derive extension from mime type for a clean filename
    const extMap: Record<string, string> = {
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
      'image/webp': 'webp', 'image/svg+xml': 'svg',
    }
    const ext = extMap[file.type] ?? 'png'
    const pathname = `school-logos/${schoolId}.${ext}`

    const blob = await put(pathname, file, {
      access: 'public',
      allowOverwrite: true,
      contentType: file.type,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error('Logo upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

// DELETE /api/schools/logo — remove school logo
export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const schoolId = await resolveSchoolId(session.user)
    if (!schoolId) return NextResponse.json({ error: 'School not found' }, { status: 400 })

    const existing = await prisma.schoolSettings.findUnique({
      where: { schoolId },
      select: { logoUrl: true },
    })
    if (existing?.logoUrl && /^https:\/\/.+\.blob\.vercel-storage\.com/i.test(existing.logoUrl)) {
      await del(existing.logoUrl)
    }

    await prisma.schoolSettings.update({
      where: { schoolId },
      data: { logoUrl: null },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Logo delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
