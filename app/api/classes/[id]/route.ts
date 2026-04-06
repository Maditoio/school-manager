import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasRole } from "@/lib/auth-utils"
import { createClassSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

// GET /api/classes/[id] - Get class details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: classId } = await params

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    return NextResponse.json({ class: classData })
  } catch (error) {
    console.error('Error fetching class:', error)
    return NextResponse.json(
      { error: 'Failed to fetch class' },
      { status: 500 }
    )
  }
}

// PUT /api/classes/[id] - Update class
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: classId } = await params

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const existingClass = await prisma.class.findFirst({
      where: {
        id: classId,
        schoolId: session.user.schoolId,
      },
      select: { id: true },
    })

    if (!existingClass) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    const normalizedBody = {
      ...body,
      name: typeof body.name === 'string' ? body.name.trim() : body.name,
      teacherId:
        typeof body.teacherId === 'string' && body.teacherId.trim() === ''
          ? undefined
          : body.teacherId,
      capacity:
        body.capacity === '' || body.capacity === null || body.capacity === undefined
          ? undefined
          : body.capacity,
    }

    const validation = createClassSchema.safeParse(normalizedBody)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues }, { status: 400 })
    }

    const { name, academicYear, teacherId, grade, capacity } = validation.data

    if (teacherId) {
      const teacher = await prisma.user.findFirst({
        where: {
          id: teacherId,
          schoolId: session.user.schoolId,
          role: 'TEACHER',
        },
        select: { id: true },
      })

      if (!teacher) {
        return NextResponse.json({ error: 'Selected teacher is invalid for this school.' }, { status: 400 })
      }
    }

    await prisma.$executeRaw`
      UPDATE classes
      SET
        name = ${name},
        academic_year = ${academicYear},
        grade = ${grade ?? null},
        capacity = ${capacity ?? null},
        teacher_id = ${teacherId ?? null},
        updated_at = NOW()
      WHERE id = ${classId}
        AND school_id = ${session.user.schoolId}
    `

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    })

    return NextResponse.json({ class: classData })
  } catch (error) {
    console.error('Error updating class:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A class with this name already exists for this academic year.' },
          { status: 409 }
        )
      }
      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: 'Selected teacher is invalid for this school.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to update class' },
      { status: 500 }
    )
  }
}

// DELETE /api/classes/[id] - Request class deletion (requires 2-admin approval + 30-day delay)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: classId } = await params

    // Verify the class exists and belongs to this school
    const classData = await prisma.class.findUnique({
      where: { id: classId },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    if (classData.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if there's already a pending deletion request for this class
    const existingRequest = await prisma.deletionRequest.findFirst({
      where: {
        resourceType: 'class',
        resourceId: classId,
        status: 'PENDING',
      },
    })

    if (existingRequest) {
      return NextResponse.json(
        {
          error: 'A deletion request for this class is already pending',
          existingRequestId: existingRequest.id,
        },
        { status: 400 }
      )
    }

    // Create a deletion request (30 days from now)
    const scheduledFor = new Date()
    scheduledFor.setDate(scheduledFor.getDate() + 30)

    const deletionRequest = await prisma.deletionRequest.create({
      data: {
        schoolId: session.user.schoolId,
        resourceType: 'class',
        resourceId: classId,
        resourceName: classData.name,
        requestedBy: session.user.id,
        scheduledFor,
        status: 'PENDING',
      },
      include: {
        requestor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        message: 'Class deletion request created. Requires approval from another admin.',
        deletionRequest,
      },
      { status: 202 }
    )
  } catch (error) {
    console.error('Error creating deletion request:', error)
    return NextResponse.json(
      { error: 'Failed to create deletion request' },
      { status: 500 }
    )
  }
}
