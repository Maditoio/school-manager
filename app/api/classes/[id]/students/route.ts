import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: classId } = await context.params
    const { searchParams } = new URL(request.url)
    const available = searchParams.get('available') === 'true'

    const classData = await prisma.class.findFirst({
      where: {
        id: classId,
        ...(session.user.schoolId ? { schoolId: session.user.schoolId } : {}),
      },
      select: { id: true, schoolId: true, academicYear: true },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    if (available) {
      const students = await prisma.student.findMany({
        where: {
          schoolId: classData.schoolId,
          academicYear: classData.academicYear,
          classId: {
            not: classId,
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          classId: true,
          class: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      })

      return NextResponse.json({ students })
    }

    const students = await prisma.student.findMany({
      where: {
        classId,
        schoolId: classData.schoolId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        classId: true,
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    return NextResponse.json({
      students,
    })
  } catch (error) {
    console.error('Error fetching class students:', error)
    return NextResponse.json({ error: 'Failed to fetch class students' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: classId } = await context.params
    const body = await request.json()
    const studentIds = Array.isArray(body.studentIds) ? body.studentIds : []

    if (studentIds.length === 0) {
      return NextResponse.json({ error: 'studentIds are required' }, { status: 400 })
    }

    const classData = await prisma.class.findFirst({
      where: {
        id: classId,
        ...(session.user.schoolId ? { schoolId: session.user.schoolId } : {}),
      },
      select: { id: true, schoolId: true, academicYear: true },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    const validStudents = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        schoolId: classData.schoolId,
        academicYear: classData.academicYear,
      },
      select: { id: true },
    })

    if (validStudents.length !== studentIds.length) {
      return NextResponse.json(
        { error: 'One or more students are invalid for this class school' },
        { status: 400 }
      )
    }

    await prisma.student.updateMany({
      where: {
        id: { in: validStudents.map((student) => student.id) },
      },
      data: {
        classId,
        academicYear: classData.academicYear,
      },
    })

    const assessments = await prisma.assessment.findMany({
      where: {
        schoolId: classData.schoolId,
        classId,
      },
      select: { id: true },
    })

    if (assessments.length > 0) {
      const studentAssessmentsData = assessments.flatMap((assessment) =>
        validStudents.map((student) => ({
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding students to class:', error)
    return NextResponse.json({ error: 'Failed to add students to class' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: classId } = await context.params
    const body = await request.json().catch(() => ({})) as { studentId?: string }
    const studentId = typeof body.studentId === 'string' ? body.studentId : ''

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
    }

    const classData = await prisma.class.findFirst({
      where: {
        id: classId,
        ...(session.user.schoolId ? { schoolId: session.user.schoolId } : {}),
      },
      select: { id: true, schoolId: true, academicYear: true },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        classId,
        schoolId: classData.schoolId,
      },
      select: { id: true },
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found in this class' }, { status: 404 })
    }

    const fallbackClass = await prisma.class.upsert({
      where: {
        schoolId_name_academicYear: {
          schoolId: classData.schoolId,
          name: 'Unassigned',
          academicYear: classData.academicYear,
        },
      },
      create: {
        schoolId: classData.schoolId,
        name: 'Unassigned',
        academicYear: classData.academicYear,
      },
      update: {},
      select: { id: true },
    })

    if (fallbackClass.id === classId) {
      return NextResponse.json(
        { error: 'Cannot remove students from the fallback Unassigned class' },
        { status: 400 }
      )
    }

    await prisma.student.update({
      where: { id: student.id },
      data: {
        classId: fallbackClass.id,
        academicYear: classData.academicYear,
      },
    })

    await prisma.studentClassHistory.create({
      data: {
        studentId: student.id,
        fromClassId: classId,
        toClassId: fallbackClass.id,
        changedById: session.user.id,
        reason: 'Removed from class',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing student from class:', error)
    return NextResponse.json({ error: 'Failed to remove student from class' }, { status: 500 })
  }
}
