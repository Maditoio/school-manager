import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const slotSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().min(1),
  dayOfWeek: z.number().int().min(1).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().optional(),
  termId: z.string().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, schoolId } = session.user
  if (!['SCHOOL_ADMIN', 'DEPUTY_ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.timetableSlot.findUnique({ where: { id } })
  if (!existing || existing.schoolId !== schoolId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()
  const parsed = slotSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, room, termId } = parsed.data

  if (startTime >= endTime) {
    return NextResponse.json({ error: 'endTime must be after startTime' }, { status: 400 })
  }

  const conflicts = await findConflicts({
    schoolId: schoolId!,
    classId,
    teacherId,
    dayOfWeek,
    startTime,
    endTime,
    excludeId: id,
  })
  if (conflicts.length > 0) {
    return NextResponse.json({ error: 'Time conflict detected', conflicts }, { status: 409 })
  }

  const slot = await prisma.timetableSlot.update({
    where: { id },
    data: { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, room, termId: termId ?? null },
    include: {
      class: { select: { name: true } },
      subject: { select: { name: true, code: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  })
  return NextResponse.json({ slot })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, schoolId } = session.user
  if (!['SCHOOL_ADMIN', 'DEPUTY_ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.timetableSlot.findUnique({ where: { id } })
  if (!existing || existing.schoolId !== schoolId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.timetableSlot.delete({ where: { id } })
  return NextResponse.json({ success: true })
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
