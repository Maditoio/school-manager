import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth()

  if (!session?.user || !['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: studentId } = await params

  const student = await prisma.student.findUnique({
    where: { id: studentId, schoolId: session.user.schoolId ?? undefined },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true, userId: true, schoolId: true },
  })

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  if (student.userId) {
    return NextResponse.json({ error: 'Student already has a login account' }, { status: 409 })
  }

  if (!student.admissionNumber) {
    return NextResponse.json({ error: 'Student has no admission number; cannot create login' }, { status: 400 })
  }

  const username = student.admissionNumber
  const temporaryPassword = student.admissionNumber

  // Check if username already taken
  const existing = await prisma.user.findUnique({ where: { username: username } })
  if (existing) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  const studentUser = await prisma.user.create({
    data: {
      email: `student-${studentId}@system.local`,
      username,
      password: await hash(temporaryPassword, 12),
      mustResetPassword: true,
      firstName: student.firstName,
      lastName: student.lastName,
      role: 'STUDENT',
      schoolId: student.schoolId,
      studentId: student.id,
    },
  })

  await prisma.student.update({
    where: { id: studentId },
    data: { userId: studentUser.id },
  })

  return NextResponse.json({
    username,
    temporaryPassword,
    message: 'Student login created. Student must change password on first login.',
  })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth()

  if (!session?.user || !['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: studentId } = await params

  const student = await prisma.student.findUnique({
    where: { id: studentId, schoolId: session.user.schoolId ?? undefined },
    select: { id: true, userId: true },
  })

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  if (!student.userId) {
    return NextResponse.json({ error: 'Student does not have a login account' }, { status: 404 })
  }

  await prisma.student.update({
    where: { id: studentId },
    data: { userId: null },
  })

  await prisma.user.delete({ where: { id: student.userId } })

  return NextResponse.json({ message: 'Student login removed successfully' })
}
