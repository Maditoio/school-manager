import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasRole } from "@/lib/auth-utils"
import { z } from "zod"

const batchSubjectSchema = z.object({
  subjects: z.array(
    z.object({
      name: z.string().min(1, "Subject name is required"),
      code: z.string().optional(),
    })
  ).min(1, "At least one subject is required"),
})

// POST /api/subjects/batch - Create multiple subjects at once
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const body = await request.json()
    const validation = batchSubjectSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues }, { status: 400 })
    }

    const { subjects } = validation.data
    const schoolId = session.user.schoolId

    // Get existing subject names for this school to avoid duplicates
    const existingSubjects = await prisma.subject.findMany({
      where: { schoolId },
      select: { name: true },
    })
    const existingNames = new Set(existingSubjects.map((s) => s.name.toLowerCase()))

    const toCreate = subjects.filter((s) => !existingNames.has(s.name.toLowerCase()))
    const skipped = subjects.filter((s) => existingNames.has(s.name.toLowerCase()))

    let created: typeof subjects = []
    if (toCreate.length > 0) {
      await prisma.subject.createMany({
        data: toCreate.map((s) => ({
          schoolId,
          name: s.name,
          code: s.code || undefined,
        })),
        skipDuplicates: true,
      })
      created = toCreate
    }

    return NextResponse.json(
      {
        created: created.length,
        skipped: skipped.length,
        skippedNames: skipped.map((s) => s.name),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error batch creating subjects:', error)
    return NextResponse.json({ error: 'Failed to create subjects' }, { status: 500 })
  }
}
