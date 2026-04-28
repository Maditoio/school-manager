import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recomputeStudentCourseProfile } from '@/lib/academic-aggregation'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const refresh = searchParams.get('refresh') === 'true'
  const studentIdQuery = searchParams.get('studentId')
  let studentId: string | null = session.user.studentId ?? null

  if (session.user.role === 'TEACHER') {
    if (!studentIdQuery) {
      return NextResponse.json({ error: 'studentId is required for teacher access' }, { status: 400 })
    }
    const targetStudent = await prisma.student.findUnique({
      where: { id: studentIdQuery },
      select: { schoolId: true },
    })
    if (!targetStudent || targetStudent.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Student not found or unavailable' }, { status: 404 })
    }
    studentId = studentIdQuery
  }

  if (session.user.role === 'STUDENT' && !studentId) {
    return NextResponse.json({ error: 'No student record' }, { status: 400 })
  }

  const schoolId = session.user.schoolId
  if (!schoolId) {
    return NextResponse.json({ error: 'No school context' }, { status: 400 })
  }

  if (!studentId) {
    return NextResponse.json({ error: 'No student record' }, { status: 400 })
  }

  if (refresh) {
    const result = await recomputeStudentCourseProfile({ schoolId, studentId, termId: searchParams.get('termId') })
    if (!result.updated) {
      if (result.reason === 'missing-profile-table') {
        return NextResponse.json({ profile: null })
      }
      return NextResponse.json({ error: result.reason ?? 'Unable to refresh profile' }, { status: 400 })
    }
    return NextResponse.json({ profile: result.profile })
  }

  let profile = null
  try {
    profile = await prisma.studentCourseProfile.findFirst({
      where: { studentId, schoolId },
      orderBy: { updatedAt: 'desc' },
    })
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2021'
    ) {
      console.warn('StudentCourseProfile table is missing, returning null profile', error)
      profile = null
    } else {
      throw error
    }
  }

  if (profile) {
    return NextResponse.json({ profile })
  }

  const result = await recomputeStudentCourseProfile({ schoolId, studentId, termId: searchParams.get('termId') })
  if (!result.updated) {
    if (result.reason === 'missing-profile-table') {
      return NextResponse.json({ profile: null })
    }
    return NextResponse.json({ error: result.reason ?? 'Unable to build profile' }, { status: 400 })
  }

  return NextResponse.json({ profile: result.profile })
}
