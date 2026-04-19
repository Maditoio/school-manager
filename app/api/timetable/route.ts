import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const slotSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().min(1),
  dayOfWeek: z.number().int().min(1).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
  room: z.string().optional(),
  termId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('classId')
  const teacherId = searchParams.get('teacherId')
  const termId = searchParams.get('termId')

  const user = session.user
  const schoolId = user.schoolId

  if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 })

  // Students: only their class
  if (user.role === 'STUDENT') {
    const studentId = user.studentId
    if (!studentId) return NextResponse.json({ error: 'No student record' }, { status: 400 })
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } })
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    const slots = await prisma.timetableSlot.findMany({
      where: { schoolId, classId: student.classId, ...(termId ? { termId } : {}) },
      include: {
        class: { select: { name: true } },
        subject: { select: { name: true, code: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })
    return NextResponse.json({ slots })
  }

  // Teachers: only their school
  const where: Record<string, unknown> = { schoolId }
  if (classId) where.classId = classId
  if (termId) where.termId = termId

  if (user.role === 'TEACHER') {
    where.teacherId = user.id
  } else if (teacherId) {
    where.teacherId = teacherId
  }

  const slots = await prisma.timetableSlot.findMany({
    where,
    include: {
      class: { select: { name: true } },
      subject: { select: { name: true, code: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })
  return NextResponse.json({ slots })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, schoolId } = session.user
  if (!['SCHOOL_ADMIN', 'DEPUTY_ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 })

  const body = await request.json()
  const parsed = slotSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 })

  const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, room, termId } = parsed.data

  if (startTime >= endTime) {
    return NextResponse.json({ error: 'endTime must be after startTime' }, { status: 400 })
  }

  // Conflict check
  const conflicts = await findConflicts({ schoolId, classId, teacherId, dayOfWeek, startTime, endTime })
  if (conflicts.length > 0) {
    return NextResponse.json({ error: 'Time conflict detected', conflicts }, { status: 409 })
  }

  const slot = await prisma.timetableSlot.create({
    data: { schoolId, classId, subjectId, teacherId, dayOfWeek, startTime, endTime, room, termId },
    include: {
      class: { select: { name: true } },
      subject: { select: { name: true, code: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  })
  return NextResponse.json({ slot }, { status: 201 })
}

async function findConflicts({
  schoolId,
  classId,
  teacherId,
  dayOfWeek,
  startTime,
  endTime,
  excludeId,
}: {
  schoolId: string
  classId: string
  teacherId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  excludeId?: string
}) {
  const existing = await prisma.timetableSlot.findMany({
    where: {
      schoolId,
      dayOfWeek,
      id: excludeId ? { not: excludeId } : undefined,
      OR: [{ classId }, { teacherId }],
    },
  })
  return existing.filter(s => s.startTime < endTime && s.endTime > startTime)
}
