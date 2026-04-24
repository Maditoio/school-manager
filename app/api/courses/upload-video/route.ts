import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { auth } from '@/lib/auth'

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const MAX_VIDEO_BYTES = 500 * 1024 * 1024 // 500 MB

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 80)
}

// POST /api/courses/upload-video
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const courseId = formData.get('courseId') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })

  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported format. Use MP4, MOV (QuickTime), or WebM.' },
      { status: 400 }
    )
  }

  if (file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum size is 500 MB.' }, { status: 400 })
  }

  const ext = file.type === 'video/mp4' ? 'mp4' : file.type === 'video/quicktime' ? 'mov' : 'webm'
  const safeName = sanitizeName(file.name || `lesson.${ext}`)
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const pathname = `courses/${session.user.schoolId}/${courseId}/videos/${uniquePart}-${safeName}`

  const blob = await put(pathname, file, {
    access: 'public',
    allowOverwrite: false,
    contentType: file.type,
  })

  return NextResponse.json({ url: blob.url }, { status: 201 })
}
