import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB

type ClientPayload = {
  courseId?: string
}

function parsePayload(rawPayload: string | null | undefined): ClientPayload {
  if (!rawPayload) return {}
  try {
    return JSON.parse(rawPayload) as ClientPayload
  } catch {
    return {}
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const session = await auth()

        if (!session?.user || session.user.role !== 'TEACHER' || !session.user.schoolId) {
          throw new Error('Unauthorized')
        }

        const payload = parsePayload(clientPayload)
        const courseId = payload.courseId

        if (!courseId) {
          throw new Error('Missing course id')
        }

        const course = await prisma.videoCourse.findFirst({
          where: {
            id: courseId,
            teacherId: session.user.id,
            schoolId: session.user.schoolId,
          },
          select: { id: true },
        })

        if (!course) {
          throw new Error('Course not found')
        }

        return {
          allowedContentTypes: ALLOWED_VIDEO_TYPES,
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            courseId,
            teacherId: session.user.id,
            schoolId: session.user.schoolId,
          }),
        }
      },
      onUploadCompleted: async () => {
        // Lesson metadata is updated from the course page after upload completes.
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload authorization failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
