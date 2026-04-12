import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type StudentAssessmentDelegate = {
  findMany: (args: {
    where: {
      studentId: string
    }
    include: {
      assessment: {
        include: {
          subject: true
        }
      }
    }
    orderBy: {
      assessment: {
        createdAt: 'desc'
      }
    }
  }) => Promise<unknown[]>
}

const db = prisma as unknown as {
  studentAssessment?: StudentAssessmentDelegate
}

// GET student assessments for a specific student
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 })
    }

    // Verify access - parents can only view their children's data
    if (session.user.role === 'PARENT') {
      const student = await prisma.student.findFirst({
        where: {
          id: studentId,
          parentId: session.user.id
        }
      })

      if (!student) {
        return NextResponse.json({ error: 'Unauthorized access to student data' }, { status: 403 })
      }
    }

    if (session.user.role === 'STUDENT' && session.user.studentId !== studentId) {
      return NextResponse.json({ error: 'Unauthorized access to student data' }, { status: 403 })
    }

    if (!db.studentAssessment) {
      return NextResponse.json({ error: 'Assessments unavailable' }, { status: 500 })
    }

    const studentAssessments = await db.studentAssessment.findMany({
      where: {
        studentId,
        assessment:
          session.user.role === 'PARENT' || session.user.role === 'STUDENT'
            ? { published: true }
            : undefined,
      },
      include: {
        assessment: {
          include: {
            subject: true
          }
        }
      },
      orderBy: {
        assessment: {
          createdAt: 'desc'
        }
      }
    })

    return NextResponse.json({ assessments: studentAssessments })
  } catch (error) {
    console.error('Error fetching student assessments:', error)
    return NextResponse.json({ error: 'Failed to fetch assessments' }, { status: 500 })
  }
}
