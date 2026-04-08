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
      // Students who are NOT already in this class (neither primary nor additional)
      const additionalEnrollments = await prisma.studentAdditionalClass.findMany({
        where: { classId, student: { schoolId: classData.schoolId } },
        select: { studentId: true },
      })
      const additionalStudentIds = additionalEnrollments.map((e) => e.studentId)

      const students = await prisma.student.findMany({
        where: {
          schoolId: classData.schoolId,
          academicYear: classData.academicYear,
          classId: { not: classId },
          id: { notIn: additionalStudentIds },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          classId: true,
          class: { select: { id: true, name: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      })

      return NextResponse.json({ students })
    }

    // Primary students
    const primaryStudents = await prisma.student.findMany({
      where: { classId, schoolId: classData.schoolId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        classId: true,
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    // Additional (cross-enrolled) students
    const additionalEnrollments = await prisma.studentAdditionalClass.findMany({
      where: { classId },
      select: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            classId: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    })

    const students = [
      ...primaryStudents.map((s) => ({ ...s, enrollmentType: 'primary' as const })),
      ...additionalEnrollments.map(({ student }) => ({ ...student, enrollmentType: 'additional' as const })),
    ]

    return NextResponse.json({ students })
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
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
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
      },
      select: { id: true, classId: true },
    })

    if (validStudents.length !== studentIds.length) {
      return NextResponse.json(
        { error: 'One or more students are invalid for this school' },
        { status: 400 }
      )
    }

    // Students whose primary class IS already this class — nothing to do for them
    const alreadyPrimary = validStudents.filter((s) => s.classId === classId).map((s) => s.id)
    // The rest need their primary classId updated to this class
    const toEnroll = validStudents.filter((s) => s.classId !== classId)

    if (toEnroll.length > 0) {
      // Update primary class assignment (fixes count display and Unassigned counter)
      await prisma.student.updateMany({
        where: { id: { in: toEnroll.map((s) => s.id) } },
        data: { classId },
      })

      // Log the class change history
      await prisma.studentClassHistory.createMany({
        data: toEnroll.map((s) => ({
          studentId: s.id,
          fromClassId: s.classId as string,
          toClassId: classId,
          changedById: session.user.id,
          reason: 'Assigned to class',
        })),
        skipDuplicates: true,
      })

      // Remove any stale additional-enrollment rows for these students in this class
      await prisma.studentAdditionalClass.deleteMany({
        where: {
          studentId: { in: toEnroll.map((s) => s.id) },
          classId,
        },
      })
    }

    // Wire all enrolled students into existing assessments for this class
    const assessments = await prisma.assessment.findMany({
      where: { schoolId: classData.schoolId, classId },
      select: { id: true },
    })

    const enrolledIds = [...toEnroll.map((s) => s.id), ...alreadyPrimary]
    if (assessments.length > 0 && enrolledIds.length > 0) {
      await prisma.studentAssessment.createMany({
        data: assessments.flatMap((a) =>
          enrolledIds.map((sid) => ({ assessmentId: a.id, studentId: sid }))
        ),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({ success: true, enrolled: toEnroll.length, alreadyPrimary: alreadyPrimary.length })
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
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: classId } = await context.params
    const body = await request.json().catch(() => ({})) as { studentId?: string; enrollmentType?: string }
    const studentId = typeof body.studentId === 'string' ? body.studentId : ''
    const enrollmentType = body.enrollmentType ?? 'primary'

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

    // Remove additional enrollment
    if (enrollmentType === 'additional') {
      const deleted = await prisma.studentAdditionalClass.deleteMany({
        where: { studentId, classId },
      })
      if (deleted.count === 0) {
        return NextResponse.json({ error: 'Additional enrollment not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    }

    // Remove primary enrollment — move to Unassigned
    const student = await prisma.student.findFirst({
      where: { id: studentId, classId, schoolId: classData.schoolId },
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
      data: { classId: fallbackClass.id, academicYear: classData.academicYear },
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
