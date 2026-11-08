import { prisma } from '@/lib/prisma'
import { calculateAttendancePercentage } from '@/lib/utils'

export type ParentChild = {
  id: string
  name: string
  className: string
  classId: string | null
  firstName: string
  lastName: string
  admissionNumber: string | null
  dateOfBirth: Date | null
  gender: string | null
}

export async function getParentChildren(parentId: string, schoolId: string | null): Promise<ParentChild[]> {
  const rows = await prisma.student.findMany({
    where: {
      parentId,
      ...(schoolId ? { schoolId } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      dateOfBirth: true,
      gender: true,
      classId: true,
      class: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return rows.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    className: c.class?.name || '—',
    classId: c.classId,
    firstName: c.firstName,
    lastName: c.lastName,
    admissionNumber: c.admissionNumber,
    dateOfBirth: c.dateOfBirth,
    gender: c.gender ? String(c.gender) : null,
  }))
}

export function resolveSelectedChild(children: ParentChild[], childId?: string | null) {
  if (!children.length) return null
  if (childId) {
    const match = children.find((c) => c.id === childId)
    if (match) return match
  }
  return children[0]
}

export async function getChildResults(studentId: string) {
  const items = await prisma.studentAssessment.findMany({
    where: {
      studentId,
      graded: true,
      score: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      score: true,
      feedback: true,
      graded: true,
      submittedAt: true,
      updatedAt: true,
      assessment: {
        select: {
          id: true,
          title: true,
          type: true,
          totalMarks: true,
          dueDate: true,
          subject: { select: { name: true, code: true } },
        },
      },
    },
  })

  return items.map((item) => {
    const totalMarks = item.assessment.totalMarks || 1
    const score = item.score || 0
    const percent = Math.round((score / totalMarks) * 100)
    return {
      id: item.id,
      score,
      totalMarks,
      percent,
      feedback: item.feedback,
      graded: item.graded,
      date: item.submittedAt || item.updatedAt || item.assessment.dueDate,
      title: item.assessment.title,
      type: item.assessment.type,
      subjectName: item.assessment.subject.name,
      subjectCode: item.assessment.subject.code,
    }
  })
}

export async function getChildAttendance(studentId: string) {
  const [records, totalCount, presentCount] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: 60,
      select: { id: true, date: true, status: true },
    }),
    prisma.attendance.count({ where: { studentId } }),
    prisma.attendance.count({ where: { studentId, status: 'PRESENT' } }),
  ])

  return {
    records,
    rate: calculateAttendancePercentage(presentCount, totalCount),
    totalCount,
    presentCount,
  }
}

export async function getChildAnnouncements(schoolId: string | null, classId: string | null) {
  const [schoolAnnouncements, classAnnouncements] = await Promise.all([
    prisma.announcement.findMany({
      where: { schoolId: schoolId || undefined },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        title: true,
        message: true,
        imageUrl: true,
        createdAt: true,
        creator: { select: { firstName: true, lastName: true } },
      },
    }),
    classId
      ? prisma.classAnnouncement.findMany({
          where: {
            schoolId: schoolId || undefined,
            classId,
          },
          orderBy: { createdAt: 'desc' },
          take: 40,
          select: {
            id: true,
            title: true,
            message: true,
            createdAt: true,
            class: { select: { name: true } },
            creator: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
  ])

  return [
    ...schoolAnnouncements.map((a) => ({
      ...a,
      type: 'school' as const,
      className: null as string | null,
    })),
    ...classAnnouncements.map((a) => ({
      id: a.id,
      title: a.title,
      message: a.message,
      imageUrl: null as string | null,
      createdAt: a.createdAt,
      creator: a.creator,
      type: 'class' as const,
      className: a.class?.name || null,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export async function getChildUpcoming(schoolId: string | null, classId: string | null) {
  const now = new Date()
  if (!classId) return []

  const items = await prisma.assessment.findMany({
    where: {
      schoolId: schoolId || undefined,
      classId,
      published: true,
      OR: [
        { dueDate: { gte: now } },
        { dueDate: null, createdAt: { gte: new Date(now.getTime() - 14 * 86400000) } },
      ],
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    take: 40,
    select: {
      id: true,
      title: true,
      type: true,
      dueDate: true,
      totalMarks: true,
      description: true,
      subject: { select: { name: true } },
    },
  })

  return items.map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    dueDate: a.dueDate,
    totalMarks: a.totalMarks,
    description: a.description,
    subjectName: a.subject.name,
  }))
}
