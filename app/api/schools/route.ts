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
        schoolBilling: true,
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
    const billingYear = validation.data.billingYear ?? new Date().getFullYear()
    const enabledModules = Array.isArray(validation.data.enabledModules)
      ? validation.data.enabledModules.map((item) => item.trim()).filter(Boolean)
      : []

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

    const currentAcademicYear = new Date().getFullYear()

    // Create school with admin user and a default Unassigned class
    const school = await prisma.school.create({
      data: {
        name,
        plan,
        schoolBilling: {
          create: {
            onboardingFee: validation.data.onboardingFee ?? 0,
            onboardingStatus: validation.data.onboardingStatus ?? 'PENDING',
            annualPricePerStudent: validation.data.annualPricePerStudent ?? 0,
            licensedStudentCount: validation.data.licensedStudentCount ?? 0,
            billingYear,
            licenseStartDate: validation.data.licenseStartDate ? new Date(validation.data.licenseStartDate) : null,
            licenseEndDate: validation.data.licenseEndDate ? new Date(validation.data.licenseEndDate) : null,
            enabledModules,
            notes: validation.data.billingNotes?.trim() || null,
          },
        },
        users: {
          create: {
            email: normalizedAdminEmail,
            password: hashedPassword,
            firstName: adminFirstName,
            lastName: adminLastName,
            role: 'SCHOOL_ADMIN',
          },
        },
        classes: {
          create: {
            name: 'Unassigned',
            academicYear: currentAcademicYear,
            grade: 'Unassigned',
          },
        },
      },
      include: {
        schoolBilling: true,
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
