import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/classes/with-subjects
// Returns all classes for the school with their ClassSubjectTeacher assignments (subject + teacher)
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, schoolId } = session.user

    if (role !== 'SCHOOL_ADMIN' && role !== 'DEPUTY_ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const where: Record<string, unknown> = {}
    if (schoolId) where.schoolId = schoolId

    const classes = await prisma.class.findMany({
      where,
      orderBy: [{ academicYear: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        grade: true,
        academicYear: true,
        subjectAssignments: {
          orderBy: { subject: { name: 'asc' } },
          select: {
            subject: {
              select: { id: true, name: true, code: true },
            },
            teacher: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    })

    return NextResponse.json({ classes })
  } catch (error) {
    console.error('Error fetching classes with subjects:', error)
    return NextResponse.json({ error: 'Failed to fetch classes' }, { status: 500 })
  }
}
