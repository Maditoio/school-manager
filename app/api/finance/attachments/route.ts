import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
const MAX_BYTES = 8 * 1024 * 1024

type AttachmentKind = 'fees' | 'expenses'

async function resolveSchoolId(sessionUser: { email?: string | null; schoolId?: string | null }) {
  if (sessionUser.schoolId) return sessionUser.schoolId
  if (!sessionUser.email) return null

  const user = await prisma.user.findUnique({
    where: { email: sessionUser.email.toLowerCase() },
    select: { schoolId: true },
  })

  return user?.schoolId ?? null
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 80)
}

function extensionFromType(type: string) {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }
  return map[type] ?? 'bin'
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE', 'FINANCE_MANAGER'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const schoolId = await resolveSchoolId(session.user)
    if (!schoolId) {
      return NextResponse.json({ error: 'School not found' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const kind = formData.get('kind') as AttachmentKind | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!kind || (kind !== 'fees' && kind !== 'expenses')) {
      return NextResponse.json({ error: 'Invalid attachment kind' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Use PNG, JPEG, GIF, WebP, or PDF.' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum size is 8 MB.' }, { status: 400 })
    }

    const ext = extensionFromType(file.type)
    const safeName = sanitizeFileName(file.name || `document.${ext}`)
    const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const pathname = `finance/${schoolId}/${kind}/${uniquePart}-${safeName.endsWith(`.${ext}`) ? safeName : `${safeName}.${ext}`}`

    const blob = await put(pathname, file, {
      access: 'public',
      allowOverwrite: false,
      contentType: file.type,
    })

    return NextResponse.json({
      url: blob.url,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    })
  } catch (error) {
    console.error('Finance attachment upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
