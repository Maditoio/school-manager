import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createStudentSchema } from "@/lib/validations"
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

// GET /api/students - List students
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const parentId = searchParams.get('parentId')
    const statusReason = (searchParams.get('statusReason') || '').trim()
    const statusDateFrom = (searchParams.get('statusDateFrom') || '').trim()
    const statusDateTo = (searchParams.get('statusDateTo') || '').trim()

    const where: Prisma.StudentWhereInput = {}

    // Filter by school for non-super admins
    if (session.user.schoolId) {
      where.schoolId = session.user.schoolId
    }

    // For teachers, only show students in classes they teach
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

      const teacherClassIds = assignedRows.map((row) => row.id)
      if (teacherClassIds.length === 0) {
        return NextResponse.json({ students: [], pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 1 } })
      }

      if (classId) {
        if (!teacherClassIds.includes(classId)) {
          return NextResponse.json({ students: [], pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 1 } })
        }
        where.classId = classId
      } else {
        where.classId = { in: teacherClassIds }
      }
    }

    // Filter by parent (for parent role)
    if (session.user.role === 'PARENT') {
      where.parentId = session.user.id
    } else if (parentId) {
      where.parentId = parentId
    }

    // Filter by class
    if (classId && session.user.role !== 'TEACHER') {
      where.classId = classId
    }

    const whereAny = where as Record<string, unknown>

    if (statusReason) {
      whereAny.status = 'LEFT'
      whereAny.statusReason = statusReason
    }

    if (statusDateFrom || statusDateTo) {
      const dateFilter: { gte?: Date; lte?: Date } = {}

      if (statusDateFrom) {
        const parsedFrom = new Date(statusDateFrom)
        if (!Number.isNaN(parsedFrom.getTime())) {
          dateFilter.gte = parsedFrom
        }
      }

      if (statusDateTo) {
        const parsedTo = new Date(statusDateTo)
        if (!Number.isNaN(parsedTo.getTime())) {
          parsedTo.setHours(23, 59, 59, 999)
          dateFilter.lte = parsedTo
        }
      }

      if (dateFilter.gte || dateFilter.lte) {
        whereAny.statusDate = dateFilter
      }
    }

    const query = (searchParams.get('q') || '').trim()
    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { admissionNumber: { contains: query, mode: 'insensitive' } },
        { parentName: { contains: query, mode: 'insensitive' } },
        { parentEmail: { contains: query, mode: 'insensitive' } },
        {
          class: {
            name: { contains: query, mode: 'insensitive' },
          },
        },
      ]
    }

    const hasServerPagination =
      searchParams.has('page') || searchParams.has('pageSize') || searchParams.has('q')

    if (hasServerPagination) {
      const parsedPage = Number(searchParams.get('page') || '1')
      const parsedPageSize = Number(searchParams.get('pageSize') || '10')

      const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1
      const pageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0
        ? Math.min(Math.floor(parsedPageSize), 100)
        : 10

      const totalCount = await prisma.student.count({ where })
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
      const currentPage = Math.min(page, totalPages)
      const skip = (currentPage - 1) * pageSize

      const students = await prisma.student.findMany({
        where,
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
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: pageSize,
      })

      return NextResponse.json({
        students,
        pagination: {
          page: currentPage,
          pageSize,
          totalCount,
          totalPages,
        },
      })
    }

    const students = await prisma.student.findMany({
      where,
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
      orderBy: { lastName: 'asc' },
    })

    return NextResponse.json({ students })
  } catch (error) {
    console.error('Error fetching students:', error)
    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    )
  }
}

// POST /api/students - Create a new student
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createStudentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const {
      firstName,
      lastName,
      classId,
      status,
      parentId,
      parentName,
      parentEmail,
      parentPhone,
      emergencyContactName,
      emergencyContactPhone,
      dateOfBirth,
      admissionNumber,
    } = validation.data

    // Verify class belongs to school
    const classData = await prisma.class.findUnique({
      where: { id: classId },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    if (session.user.schoolId && classData.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const resolvedAcademicYear = validation.data.academicYear ?? classData.academicYear

    let linkedParentId = parentId
    if (!linkedParentId) {
      linkedParentId = await ensureParentUser({
        schoolId: classData.schoolId,
        parentEmail,
        parentName,
      })
    }

    const generatedAdmissionNumber = await generateAdmissionNumber(classData.schoolId, resolvedAcademicYear)
    const resolvedAdmissionNumber = String(admissionNumber || '').trim() || generatedAdmissionNumber

    const student = await prisma.student.create({
      data: {
        schoolId: classData.schoolId,
        firstName,
        lastName,
        classId,
        parentId: linkedParentId,
        parentName: parentName?.trim() || null,
        parentEmail: parentEmail?.trim().toLowerCase() || null,
        parentPhone: parentPhone?.trim() || null,
        emergencyContactName: emergencyContactName?.trim() || null,
        emergencyContactPhone: emergencyContactPhone?.trim() || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        admissionNumber: resolvedAdmissionNumber,
        status: status || 'ACTIVE',
        statusDate: new Date(),
        academicYear: resolvedAcademicYear,
      } as Prisma.StudentUncheckedCreateInput,
      include: {
        class: true,
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

    await prisma.studentClassHistory.create({
      data: {
        studentId: student.id,
        fromClassId: null,
        toClassId: classId,
        changedById: session.user.id,
        reason: 'Initial class assignment',
      },
    })

    const prismaAny = prisma as unknown as {
      studentStatusHistory?: {
        create: (args: unknown) => Promise<unknown>
      }
    }

    if (prismaAny.studentStatusHistory?.create) {
      await prismaAny.studentStatusHistory.create({
        data: {
          studentId: student.id,
          status: status || 'ACTIVE',
          reason: null,
          effectiveAt: new Date(),
          notes: 'Initial enrollment status',
          changedById: session.user.id,
        },
      })
    }

    return NextResponse.json({ student }, { status: 201 })
  } catch (error) {
    console.error('Error creating student:', error)
    return NextResponse.json(
      { error: 'Failed to create student' },
      { status: 500 }
    )
  }
}
