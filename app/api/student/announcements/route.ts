import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/student/announcements
// Returns both school-wide announcements and class announcements for the logged-in student.
export async function GET() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'STUDENT' || !session.user.studentId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { studentId, schoolId } = session.user

  if (!schoolId) {
    return NextResponse.json({ error: 'School not found' }, { status: 400 })
  }

  // Look up the student's class
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { classId: true },
  })

  const [schoolAnnouncements, classAnnouncements] = await Promise.all([
    prisma.announcement.findMany({
      where: { schoolId },
      include: {
        creator: { select: { firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    student?.classId
      ? prisma.classAnnouncement.findMany({
          where: { schoolId, classId: student.classId },
          include: {
            creator: { select: { firstName: true, lastName: true, role: true } },
            class: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : Promise.resolve([]),
  ])

  const combined = [
    ...schoolAnnouncements.map(a => ({ ...a, type: 'school' as const, class: null })),
    ...classAnnouncements.map(a => ({ ...a, type: 'class' as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return NextResponse.json({ announcements: combined })
}
