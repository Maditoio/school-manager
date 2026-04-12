import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
const MAX_BYTES = 2 * 1024 * 1024

async function resolveSchoolId(sessionUser: { email?: string | null; schoolId?: string | null }) {
  if (sessionUser.schoolId) return sessionUser.schoolId
  if (!sessionUser.email) return null
  const user = await prisma.user.findUnique({
    where: { email: sessionUser.email.toLowerCase() },
    select: { schoolId: true },
  })
  return user?.schoolId ?? null
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const schoolId = await resolveSchoolId(session.user)
    if (!schoolId) {
      return NextResponse.json({ error: 'School not found' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Use PNG, JPEG, GIF, WebP or SVG.' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum size is 2 MB.' }, { status: 400 })
    }

    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    }
    const ext = extMap[file.type] ?? 'png'
    const pathname = `announcement-images/${schoolId}/${Date.now()}.${ext}`

    const blob = await put(pathname, file, {
      access: 'public',
      allowOverwrite: false,
      contentType: file.type,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error('Announcement image upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}