import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createUserSchema } from "@/lib/validations"
import { hasRole } from "@/lib/auth-utils"
import { hash } from "bcryptjs"
import { resolveTeacherLoginIdentity } from "@/lib/teacher-login"

const DEFAULT_TEACHER_PASSWORD = 'default12345'

// GET /api/users - Get users
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const schoolId = searchParams.get('schoolId')

    const where: Record<string, unknown> = {}

    // Filter by school for non-super admins
    if (session.user.schoolId) {
      where.schoolId = session.user.schoolId
    }

    // Super admin can filter users by school
    if (session.user.role === 'SUPER_ADMIN' && schoolId) {
      where.schoolId = schoolId
    }

    // Filter by role
    if (role) {
      where.role = role
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        title: true,
        phone: true,
        role: true,
        schoolId: true,
        suspended: true,
        suspensionReason: true,
        school: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// POST /api/users - Create user
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createUserSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { password, firstName, lastName, role, schoolId, title, phone } = validation.data
    const rawEmail = (validation.data.email || '').trim().toLowerCase()

    if (session.user.role !== 'SUPER_ADMIN' && !['TEACHER', 'PARENT', 'FINANCE', 'FINANCE_MANAGER', 'DEPUTY_ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'You are not allowed to create this role' },
        { status: 403 }
      )
    }

    // DEPUTY_ADMIN cannot create other DEPUTY_ADMIN users
    if (session.user.role === 'DEPUTY_ADMIN' && role === 'DEPUTY_ADMIN') {
      return NextResponse.json(
        { error: 'You are not allowed to create this role' },
        { status: 403 }
      )
    }

    const trimmedPassword = (password || '').trim()
    const useDefaultTeacherPassword = role === 'TEACHER' && trimmedPassword.length === 0
    const finalPassword = useDefaultTeacherPassword ? DEFAULT_TEACHER_PASSWORD : trimmedPassword

    if (!finalPassword) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // Use session school ID if not super admin
    const finalSchoolId = session.user.role === 'SUPER_ADMIN' ? schoolId : session.user.schoolId

    if (!finalSchoolId) {
      return NextResponse.json(
        { error: 'School ID required' },
        { status: 400 }
      )
    }

    let email = rawEmail
    let username: string | null = null
    let usedSyntheticEmail = false

    if (role === 'TEACHER') {
      const identity = await resolveTeacherLoginIdentity({
        email: rawEmail,
        phone,
        firstName,
        lastName,
      })
      email = identity.email
      username = identity.username
      usedSyntheticEmail = identity.usedSyntheticEmail
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await hash(finalPassword, 12)

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName,
        title: title?.trim() || null,
        phone: phone?.trim() || null,
        role,
        schoolId: finalSchoolId,
        // All admin-created accounts must change their password on first login
        mustResetPassword: true,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        title: true,
        phone: true,
        role: true,
        schoolId: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      {
        user,
        loginUsername: username || user.email,
        temporaryPassword: useDefaultTeacherPassword ? DEFAULT_TEACHER_PASSWORD : undefined,
        usedSyntheticEmail,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
