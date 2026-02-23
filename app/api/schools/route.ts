import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSchoolSchema } from "@/lib/validations"
import { hash } from "bcryptjs"

// GET /api/schools - List all schools (Super Admin only)
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schools = await prisma.school.findMany({
      include: {
        _count: {
          select: {
            users: true,
            students: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ schools })
  } catch (error) {
    console.error('Error fetching schools:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schools' },
      { status: 500 }
    )
  }
}

// POST /api/schools - Create a new school (Super Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createSchoolSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { name, plan, adminPassword, adminFirstName, adminLastName } = validation.data
    const normalizedAdminEmail = validation.data.adminEmail.trim().toLowerCase()

    // Check if admin email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedAdminEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await hash(adminPassword, 12)

    // Create school with admin user
    const school = await prisma.school.create({
      data: {
        name,
        plan,
        users: {
          create: {
            email: normalizedAdminEmail,
            password: hashedPassword,
            firstName: adminFirstName,
            lastName: adminLastName,
            role: 'SCHOOL_ADMIN',
          },
        },
      },
      include: {
        users: {
          where: { role: 'SCHOOL_ADMIN' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json({ school }, { status: 201 })
  } catch (error) {
    console.error('Error creating school:', error)
    return NextResponse.json(
      { error: 'Failed to create school' },
      { status: 500 }
    )
  }
}
