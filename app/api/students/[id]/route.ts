import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasRole } from "@/lib/auth-utils"
import { Prisma } from "@prisma/client"
import { hash } from "bcryptjs"

const DEFAULT_PARENT_PASSWORD = 'parent1234'

function splitParentName(name?: string | null) {
  const normalized = name?.trim() || 'Parent'
  const parts = normalized.split(/\s+/).filter(Boolean)
  const firstName = parts[0] || 'Parent'
  const lastName = parts.slice(1).join(' ') || 'Guardian'
  return { firstName, lastName }
}

async function ensureParentUser(params: {
  schoolId: string
  parentEmail?: string | null
  parentName?: string | null
}): Promise<string | undefined> {
  const normalizedEmail = params.parentEmail?.trim().toLowerCase() || ''
  if (!normalizedEmail) {
    return undefined
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      role: true,
    },
  })

  if (existingByEmail) {
    if (existingByEmail.role !== 'PARENT') {
      throw new Error('Parent email already belongs to a non-parent account')
    }
    return existingByEmail.id
  }

  const existingParent = await prisma.user.findFirst({
    where: {
      schoolId: params.schoolId,
      role: 'PARENT',
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  })

  if (existingParent) {
    return existingParent.id
  }

  const { firstName, lastName } = splitParentName(params.parentName)
  const hashedPassword = await hash(DEFAULT_PARENT_PASSWORD, 12)

  const parentUser = await prisma.user.create({
    data: {
      schoolId: params.schoolId,
      role: 'PARENT',
      email: normalizedEmail,
      firstName,
      lastName,
      password: hashedPassword,
    },
    select: { id: true },
  })

  await prisma.$executeRaw`
    UPDATE users
    SET must_reset_password = true
    WHERE id = ${parentUser.id}
  `

  return parentUser.id
}

async function generateAdmissionNumber(schoolId: string, academicYear: number): Promise<string> {
  const prefix = `ADM-${academicYear}-`
  const existingAdmissionNumbers = await prisma.student.findMany({
    where: {
      schoolId,
      academicYear,
      admissionNumber: {
        startsWith: prefix,
      },
    },
    select: {
      admissionNumber: true,
    },
  })

  const usedCodes = new Set<string>()
  const pattern = new RegExp(`^ADM-${academicYear}-(\\d{4})$`)

  for (const row of existingAdmissionNumbers) {
    const admissionNumber = row.admissionNumber || ''
    const match = admissionNumber.match(pattern)
    if (match?.[1]) {
      usedCodes.add(match[1])
    }
  }

  for (let number = 0; number < 10000; number += 1) {
    const code = String(number).padStart(4, '0')
    if (!usedCodes.has(code)) {
      return `${prefix}${code}`
    }
  }

  throw new Error(`Admission number space exhausted for academic year ${academicYear}`)
}

// GET /api/students/[id] - Get student details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: studentId } = await params

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: {
          select: {
            name: true,
            grade: true,
          },
        },
        parent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    return NextResponse.json({ student })
  } catch (error) {
    console.error('Error fetching student:', error)
    return NextResponse.json(
      { error: 'Failed to fetch student' },
      { status: 500 }
    )
  }
}

// PUT /api/students/[id] - Update student
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: studentId } = await params

    let resolvedAcademicYear: number | undefined
    let resolvedSchoolId: string | undefined

    if (body.classId) {
      const classData = await prisma.class.findUnique({
        where: { id: body.classId },
        select: { schoolId: true, academicYear: true },
      })

      if (!classData) {
        return NextResponse.json({ error: 'Class not found' }, { status: 404 })
      }

      if (session.user.schoolId && classData.schoolId !== session.user.schoolId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      resolvedAcademicYear = Number(body.academicYear) || classData.academicYear
      resolvedSchoolId = classData.schoolId
    }

    let linkedParentId = body.parentId

    const existingStudent = await prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, classId: true, academicYear: true, admissionNumber: true, status: true },
    } as Prisma.StudentFindUniqueArgs) as {
      schoolId: string
      classId: string
      academicYear: number
      admissionNumber: string | null
      status?: string
    } | null

    if (!existingStudent) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    if (!resolvedSchoolId) {
      resolvedSchoolId = existingStudent.schoolId
    }

    if (!resolvedAcademicYear) {
      resolvedAcademicYear = existingStudent.academicYear
    }

    if (!linkedParentId) {
      linkedParentId = await ensureParentUser({
        schoolId: resolvedSchoolId,
        parentEmail: body.parentEmail,
        parentName: body.parentName,
      })
    }

    const resolvedAdmissionNumber =
      String(body.admissionNumber || '').trim() ||
      existingStudent.admissionNumber ||
      (await generateAdmissionNumber(resolvedSchoolId, resolvedAcademicYear))

    const allowedStatuses = new Set(['ACTIVE', 'LEFT'])
    const resolvedStatus =
      typeof body.status === 'string' && allowedStatuses.has(body.status)
        ? body.status
        : undefined

    const student = await prisma.student.update({
      where: { id: studentId },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        admissionNumber: resolvedAdmissionNumber,
        classId: body.classId,
        academicYear: resolvedAcademicYear,
        status: resolvedStatus,
        statusReason: resolvedStatus === 'LEFT' ? 'OTHER' : resolvedStatus === 'ACTIVE' ? null : undefined,
        statusDate: resolvedStatus ? new Date() : undefined,
        statusNotes: resolvedStatus ? 'Updated via student edit form' : undefined,
        parentId: linkedParentId,
        parentName: body.parentName !== undefined ? String(body.parentName || '').trim() || null : undefined,
        parentEmail:
          body.parentEmail !== undefined
            ? String(body.parentEmail || '').trim().toLowerCase() || null
            : undefined,
        parentPhone: body.parentPhone !== undefined ? String(body.parentPhone || '').trim() || null : undefined,
        emergencyContactName:
          body.emergencyContactName !== undefined
            ? String(body.emergencyContactName || '').trim() || null
            : undefined,
        emergencyContactPhone:
          body.emergencyContactPhone !== undefined
            ? String(body.emergencyContactPhone || '').trim() || null
            : undefined,
      } as Prisma.StudentUncheckedUpdateInput,
      include: {
        class: {
          select: {
            name: true,
            grade: true,
          },
        },
        parent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    const nextClassId = typeof body.classId === 'string' ? body.classId : existingStudent.classId
    if (nextClassId !== existingStudent.classId) {
      await prisma.studentClassHistory.create({
        data: {
          studentId,
          fromClassId: existingStudent.classId,
          toClassId: nextClassId,
          changedById: session.user.id,
          reason: 'Class updated by admin',
        },
      })
    }

    if (resolvedStatus && resolvedStatus !== existingStudent.status) {
      const prismaAny = prisma as unknown as {
        studentStatusHistory?: {
          create: (args: unknown) => Promise<unknown>
        }
      }

      if (prismaAny.studentStatusHistory?.create) {
        await prismaAny.studentStatusHistory.create({
          data: {
            studentId,
            status: resolvedStatus,
            reason: resolvedStatus === 'LEFT' ? 'OTHER' : null,
            effectiveAt: new Date(),
            notes: 'Updated via student edit form',
            changedById: session.user.id,
          },
        })
      }
    }

    return NextResponse.json({ student })
  } catch (error) {
    console.error('Error updating student:', error)
    return NextResponse.json(
      { error: 'Failed to update student' },
      { status: 500 }
    )
  }
}

// DELETE /api/students/[id] - Delete student
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: studentId } = await params

    await prisma.student.delete({
      where: { id: studentId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting student:', error)
    return NextResponse.json(
      { error: 'Failed to delete student' },
      { status: 500 }
    )
  }
}
