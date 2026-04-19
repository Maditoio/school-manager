import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('classId') ?? ''
  const teacherId = searchParams.get('teacherId') ?? ''
  const dayOfWeek = parseInt(searchParams.get('dayOfWeek') ?? '0')
  const startTime = searchParams.get('startTime') ?? ''
  const endTime = searchParams.get('endTime') ?? ''
  const excludeId = searchParams.get('excludeId') ?? undefined
  const schoolId = session.user.schoolId

  if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 })
  if (!classId || !teacherId || !dayOfWeek || !startTime || !endTime) {
    return NextResponse.json({ hasConflict: false, conflicts: [] })
  }

  const existing = await prisma.timetableSlot.findMany({
    where: {
      schoolId,
      dayOfWeek,
      id: excludeId ? { not: excludeId } : undefined,
      OR: [{ classId }, { teacherId }],
    },
    include: {
      class: { select: { name: true } },
      subject: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  })

  const conflicts = existing.filter(s => s.startTime < endTime && s.endTime > startTime)
  return NextResponse.json({ hasConflict: conflicts.length > 0, conflicts })
}
