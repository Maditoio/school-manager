import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type AssessmentResultsDelegate = {
  findMany: (args: {
    where: Record<string, unknown>
    include: {
      student: {
        select: {
          id: true
          firstName: true
          lastName: true
          admissionNumber: true
        }
      }
      assessment: {
        select: {
          id: true
          classId: true
          title: true
          type: true
          totalMarks: true
          dueDate: true
          createdAt: true
          subject: {
            select: {
              id: true
              name: true
              code: true
            }
          }
        }
      }
    }
    orderBy: Array<
      | { assessment: { createdAt: 'desc' } }
    >
  }) => Promise<unknown[]>
}

const db = prisma as unknown as {
  studentAssessment?: AssessmentResultsDelegate
}

type ClassDelegate = {
  findMany: (args: {
    where: Record<string, unknown>
    select: {
      id: true
      name: true
    }
  }) => Promise<Array<{ id: string; name: string }>>
}

const classDb = prisma as unknown as {
  class?: ClassDelegate
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !['TEACHER', 'SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId') || undefined
    const subjectId = searchParams.get('subjectId') || undefined
    const assessmentId = searchParams.get('assessmentId') || undefined

    if (!db.studentAssessment || !classDb.class) {
      return NextResponse.json({ error: 'Assessment results unavailable' }, { status: 500 })
    }

    let teacherClassIds: string[] | null = null

    if (session.user.role === 'TEACHER') {
      const assignedRows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT DISTINCT c.id
        FROM classes c
        LEFT JOIN class_subject_teachers cst ON cst.class_id = c.id
        WHERE c.school_id = ${session.user.schoolId}
          AND (
            c.teacher_id = ${session.user.id}
            OR cst.teacher_id = ${session.user.id}
          )
      `

      teacherClassIds = assignedRows.map((r) => r.id)

      if (teacherClassIds.length === 0) {
        return NextResponse.json({ results: [] })
      }

      if (classId && !teacherClassIds.includes(classId)) {
        return NextResponse.json({ results: [] })
      }
    }

    const assessmentWhere: Record<string, unknown> = {
      schoolId: session.user.schoolId,
      ...(classId ? { classId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(assessmentId ? { id: assessmentId } : {}),
    }

    if (session.user.role === 'TEACHER' && !classId && teacherClassIds) {
      assessmentWhere.classId = { in: teacherClassIds }
    }

    const results = await db.studentAssessment.findMany({
      where: {
        assessment: assessmentWhere,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
        assessment: {
          select: {
            id: true,
            classId: true,
            title: true,
            type: true,
            totalMarks: true,
            dueDate: true,
            createdAt: true,
            subject: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: [
        { assessment: { createdAt: 'desc' } },
      ],
    })

    const sortedResults = (results as Array<{
      assessment: {
        classId: string
      }
      student: {
        firstName: string
        lastName: string
      }
    }>).sort((a, b) => {
      const nameA = `${a.student.firstName} ${a.student.lastName}`.trim().toLowerCase()
      const nameB = `${b.student.firstName} ${b.student.lastName}`.trim().toLowerCase()
      return nameA.localeCompare(nameB)
    })

    const classIds = Array.from(
      new Set(
        (sortedResults as Array<{ assessment: { classId: string } }>).map((item) => item.assessment.classId)
      )
    )

    const classes = classIds.length
      ? await classDb.class.findMany({
          where: {
            id: { in: classIds },
            schoolId: session.user.schoolId,
          },
          select: {
            id: true,
            name: true,
          },
        })
      : []

    const classMap = new Map(classes.map((item) => [item.id, item.name]))

    const enrichedResults = (sortedResults as Array<{
      id: string
      score: number | null
      graded: boolean
      feedback?: string | null
      student: {
        id: string
        firstName: string
        lastName: string
        admissionNumber: string | null
      }
      assessment: {
        id: string
        classId: string
        title: string
        type: string
        totalMarks: number
        dueDate: string | null
        createdAt: string
        subject: {
          id: string
          name: string
          code: string | null
        }
      }
    }>).map((item) => ({
      ...item,
      assessment: {
        ...item.assessment,
        class: {
          id: item.assessment.classId,
          name: classMap.get(item.assessment.classId) || 'Unknown Class',
        },
      },
    }))

    return NextResponse.json({ results: enrichedResults })
  } catch (error) {
    console.error('Error fetching assessment results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assessment results' },
      { status: 500 }
    )
  }
}
