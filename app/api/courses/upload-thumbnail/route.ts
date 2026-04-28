import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { auth } from '@/lib/auth'

const ALLOWED_THUMBNAIL_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

// POST /api/courses/upload-thumbnail
export async function POST(request: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'Upload service not configured' },
      { status: 500 }
    )
  }

  const session = await auth()
  if (!session?.user || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_THUMBNAIL_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Use JPEG, PNG, or WebP for thumbnails.' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Thumbnail too large. Max 5 MB.' }, { status: 400 })
  }

  const ext = file.type.split('/')[1]
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const pathname = `courses/${session.user.schoolId}/thumbnails/${uniquePart}.${ext}`

  const blob = await put(pathname, file, {
    access: 'public',
    allowOverwrite: false,
    contentType: file.type,
    token,
  })

  return NextResponse.json({ url: blob.url }, { status: 201 })
}
