import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: sourceClassId } = await context.params
    const body = await request.json()

    const targetClassId = typeof body.targetClassId === 'string' ? body.targetClassId : ''
    const studentIds = Array.isArray(body.studentIds)
      ? body.studentIds.filter((id: unknown): id is string => typeof id === 'string')
      : []

    if (!targetClassId) {
      return NextResponse.json({ error: 'targetClassId is required' }, { status: 400 })
    }

    if (targetClassId === sourceClassId) {
      return NextResponse.json({ error: 'Target class must be different from current class' }, { status: 400 })
    }

    if (studentIds.length === 0) {
      return NextResponse.json({ error: 'studentIds are required' }, { status: 400 })
    }

    const sourceClass = await prisma.class.findFirst({
      where: {
        id: sourceClassId,
        ...(session.user.schoolId ? { schoolId: session.user.schoolId } : {}),
      },
      select: {
        id: true,
        schoolId: true,
      },
    })

    if (!sourceClass) {
      return NextResponse.json({ error: 'Current class not found' }, { status: 404 })
    }

    const targetClass = await prisma.class.findFirst({
      where: {
        id: targetClassId,
        schoolId: sourceClass.schoolId,
      },
      select: {
        id: true,
        schoolId: true,
      },
    })

    if (!targetClass) {
      return NextResponse.json({ error: 'Target class not found' }, { status: 404 })
    }

    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        classId: sourceClassId,
        schoolId: sourceClass.schoolId,
      },
      select: { id: true },
    })

    if (students.length !== studentIds.length) {
      return NextResponse.json(
        { error: 'One or more selected students are invalid for this class' },
        { status: 400 }
      )
    }

    await prisma.student.updateMany({
      where: {
        id: { in: students.map((student) => student.id) },
      },
      data: {
        classId: targetClass.id,
      },
    })

    await prisma.studentClassHistory.createMany({
      data: students.map((student) => ({
        studentId: student.id,
        fromClassId: sourceClassId,
        toClassId: targetClass.id,
        changedById: session.user.id,
        reason: 'Bulk class transfer',
      })),
    })

    const targetAssessments = await prisma.assessment.findMany({
      where: {
        schoolId: targetClass.schoolId,
        classId: targetClass.id,
      },
      select: { id: true },
    })

    if (targetAssessments.length > 0) {
      const studentAssessmentsData = targetAssessments.flatMap((assessment) =>
        students.map((student) => ({
          assessmentId: assessment.id,
          studentId: student.id,
        }))
      )

      if (studentAssessmentsData.length > 0) {
        await prisma.studentAssessment.createMany({
          data: studentAssessmentsData,
          skipDuplicates: true,
        })
      }
    }

    return NextResponse.json({
      success: true,
      movedCount: students.length,
    })
  } catch (error) {
    console.error('Error transferring students:', error)
    return NextResponse.json({ error: 'Failed to transfer students' }, { status: 500 })
  }
}
