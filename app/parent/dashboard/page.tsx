import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { TrackedInteractionLink } from '@/components/parent/TrackedInteractionLink'
import { prisma } from '@/lib/prisma'
import { calculateAttendancePercentage } from '@/lib/utils'

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE'

type AttendanceRecord = {
  date: Date
  status: AttendanceStatus
}

type AnnouncementPreview = {
  id: string
  title: string
  message: string
  createdAt: Date
  type?: 'school' | 'class'
}

type SubjectPerformance = {
  name: string
  percentage: number
}

type AssessmentNotification = {
  id: string
  title: string
  term: string
  dueDate: Date | null
  totalMarks: number
  createdAt: Date
  subjectName: string
}

type ChildProfile = {
  id: string
  name: string
  className: string
  classId: string
}

type MessageNotification = {
  id: string
  senderId: string
  senderName: string
  content: string
  subject: string | null
  createdAt: Date
  read: boolean
}

type DashboardData = {
  child: ChildProfile | null
  attendanceRecords: AttendanceRecord[]
  attendanceRate: number
  announcements: AnnouncementPreview[]
  assessmentNotifications: AssessmentNotification[]
  unreadMessagesCount: number
  recentMessages: MessageNotification[]
  overallAverage: number
  topSubjects: SubjectPerformance[]
}

type Messages = Record<string, unknown>

const statusDotStyles: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-500',
  ABSENT: 'bg-rose-500',
  LATE: 'bg-amber-500',
}

const formatDay = (value: Date) =>
  value.toLocaleDateString('en-US', { weekday: 'short' })

const formatDate = (value: Date) =>
  value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

async function getDashboardData(parentId: string, schoolId: string | null) {
  try {
    const studentWhere: { parentId: string; schoolId?: string } = {
      parentId,
    }
    if (schoolId) {
      studentWhere.schoolId = schoolId
    }

    const children = await prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        classId: true,
        class: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const primaryChild = children[0]

    if (!primaryChild) {
      return {
        child: null,
        attendanceRecords: [],
        attendanceRate: 0,
        announcements: [],
        assessmentNotifications: [],
        unreadMessagesCount: 0,
        recentMessages: [],
        overallAverage: 0,
        topSubjects: [],
      } as DashboardData
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where: { studentId: primaryChild.id },
      orderBy: { date: 'desc' },
      take: 5,
      select: {
        date: true,
        status: true,
      },
    })

    const totalAttendanceCount = await prisma.attendance.count({
      where: { studentId: primaryChild.id },
    })
    const presentAttendanceCount = await prisma.attendance.count({
      where: { studentId: primaryChild.id, status: 'PRESENT' },
    })
    const attendanceRate = calculateAttendancePercentage(
      presentAttendanceCount,
      totalAttendanceCount
    )

    const announcements = await prisma.announcement.findMany({
      where: { schoolId: schoolId || undefined },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        title: true,
        message: true,
        createdAt: true,
      },
    })

    const classAnnouncements = await prisma.classAnnouncement.findMany({
      where: {
        schoolId: schoolId || undefined,
        classId: primaryChild.classId,
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        title: true,
        message: true,
        createdAt: true,
      },
    })

    const combinedAnnouncements = [
      ...announcements.map((a) => ({ ...a, type: 'school' as const })),
      ...classAnnouncements.map((a) => ({ ...a, type: 'class' as const })),
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 3)

    const assessmentNotifications = await prisma.assessment.findMany({
      where: {
        schoolId: schoolId || undefined,
        classId: primaryChild.classId,
        published: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        title: true,
        dueDate: true,
        totalMarks: true,
        createdAt: true,
        type: true,
        subjectId: true,
      },
    })

    const subjectIds = Array.from(
      new Set(assessmentNotifications.map((assessment) => assessment.subjectId))
    )

    const subjects = subjectIds.length
      ? await prisma.subject.findMany({
          where: { id: { in: subjectIds } },
          select: { id: true, name: true },
        })
      : []

    const subjectNameById = new Map(subjects.map((subject) => [subject.id, subject.name]))

    const studentAssessments = await prisma.studentAssessment.findMany({
      where: {
        studentId: primaryChild.id,
        graded: true,
        score: { not: null },
      },
      select: {
        score: true,
        assessment: {
          select: {
            totalMarks: true,
            subject: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    const subjectMap = new Map<string, { name: string; total: number; count: number }>()
    let overallTotal = 0
    let overallCount = 0

    studentAssessments.forEach((item) => {
      const maxScore = item.assessment.totalMarks || 1
      const percent = ((item.score || 0) / maxScore) * 100
      overallTotal += percent
      overallCount += 1

      const key = item.assessment.subject.name
      const existing = subjectMap.get(key)
      if (existing) {
        existing.total += percent
        existing.count += 1
      } else {
        subjectMap.set(key, { name: key, total: percent, count: 1 })
      }
    })

    const overallAverage = overallCount > 0 ? Math.round(overallTotal / overallCount) : 0

    const topSubjects = Array.from(subjectMap.values())
      .map((subject) => ({
        name: subject.name,
        percentage: Math.round(subject.total / subject.count),
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3)

    const unreadMessagesCount = await prisma.message.count({
      where: {
        schoolId: schoolId || undefined,
        receiverId: parentId,
        read: false,
      },
    })

    const recentMessages = await prisma.message.findMany({
      where: {
        schoolId: schoolId || undefined,
        receiverId: parentId,
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        senderId: true,
        subject: true,
        content: true,
        createdAt: true,
        read: true,
        sender: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return {
      child: {
        id: primaryChild.id,
        name: `${primaryChild.firstName} ${primaryChild.lastName}`,
        className: primaryChild.class?.name || '-',
        classId: primaryChild.classId,
      },
      attendanceRecords,
      attendanceRate,
      announcements: combinedAnnouncements,
      assessmentNotifications: assessmentNotifications.map((assessment: {
        id: string
        title: string
        dueDate: Date | null
        totalMarks: number
        createdAt: Date
        type: string
        subjectId: string
      }) => ({
        id: assessment.id,
        title: assessment.title,
        term: assessment.type,
        dueDate: assessment.dueDate,
        totalMarks: assessment.totalMarks,
        createdAt: assessment.createdAt,
        subjectName: subjectNameById.get(assessment.subjectId) || 'Subject',
      })),
      unreadMessagesCount,
      recentMessages: recentMessages.map((message) => ({
        id: message.id,
        senderId: message.senderId,
        senderName:
          `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() ||
          'School Staff',
        content: message.content,
        subject: message.subject,
        createdAt: message.createdAt,
        read: message.read,
      })),
      overallAverage,
      topSubjects,
    } as DashboardData
  } catch (error) {
    console.error('Error getting parent dashboard data:', error)
    return null
  }
}

async function getMessages() {
  const locale = 'en'
  const messages = (await import(`@/messages/${locale}.json`)).default as Messages
  return messages
}

function getMessageValue(messages: Messages, key: string) {
  return key
    .split('.')
    .reduce<unknown>((value, part) => {
      if (value && typeof value === 'object') {
        return (value as Record<string, unknown>)[part]
      }
      return undefined
    }, messages)
}

function createTranslator(messages: Messages) {
  return (key: string) => {
    const value = getMessageValue(messages, key)
    return typeof value === 'string' ? value : key
  }
}

export default async function ParentDashboard() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'PARENT') {
    redirect('/login')
  }

  const messages = await getMessages()
  const t = createTranslator(messages)
  const data = await getDashboardData(session.user.id, session.user.schoolId)
  const restrictedFeaturesBlocked = Boolean(session.user.paymentAccessBlocked)

  const navItems = [
    { label: 'Dashboard', href: '/parent/dashboard', icon: '🏠' },
    { label: 'Attendance', href: '/parent/attendance', icon: '📅' },
    { label: 'Results', href: '/parent/results', icon: '📊' },
    { label: 'Messages', href: '/parent/messages', icon: '💬' },
  ]

  const announcementCutoff = new Date()
  announcementCutoff.setDate(announcementCutoff.getDate() - 7)

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'User',
        role: t('roles.parent'),
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="min-h-screen bg-linear-to-b from-emerald-50 via-white to-blue-50">
        <div className="mx-auto w-full max-w-md space-y-5 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] px-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {t('parent.dashboard.childProfile')}
          </p>
          {data?.child ? (
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-2xl font-semibold text-white shadow-md">
                {data.child.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-slate-900">
                  {data.child.name}
                </h1>
                <p className="text-sm text-slate-500">
                  {t('parent.dashboard.classLabel')}: {data.child.className}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-linear-to-r from-slate-50 to-slate-100 p-4 text-sm text-slate-500 border border-slate-200">
              <p className="font-semibold text-slate-700">{t('parent.dashboard.noChild')}</p>
              <p className="mt-1">{t('parent.dashboard.contactSchool')}</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Messages</h2>
              <p className="text-xs text-slate-500">Latest updates from teachers and school admin</p>
            </div>
            <span className="rounded-full bg-linear-to-r from-emerald-100 to-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
              {data?.unreadMessagesCount || 0} unread
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {data?.recentMessages.length ? (
              data.recentMessages.map((message) => (
                <a
                  key={message.id}
                  href={`/parent/messages?contactId=${encodeURIComponent(message.senderId)}`}
                  className={`block rounded-xl border px-4 py-3 transition-colors ${
                    message.read
                      ? 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">{message.senderName}</p>
                    {!message.read && (
                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600 line-clamp-2">{message.content}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDate(message.createdAt)}</p>
                </a>
              ))
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No new messages yet.
              </p>
            )}
          </div>

          <a
            href="/parent/messages"
            className="mt-4 inline-flex rounded-full bg-linear-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            Open Messages
          </a>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {t('parent.dashboard.attendanceTitle')}
              </h2>
              <p className="text-xs text-slate-500">{t('parent.dashboard.attendanceSubtitle')}</p>
            </div>
            <span className="rounded-full bg-linear-to-r from-slate-100 to-slate-50 px-3 py-1 text-xs text-slate-500 border border-slate-200">
              {data?.attendanceRecords.length || 0}
            </span>
          </div>

          {restrictedFeaturesBlocked ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
              {session.user.paymentAccessReason || 'Attendance is unavailable until the school records license coverage for this student.'}
            </div>
          ) : (
            <>
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {data?.attendanceRecords.length ? (
                  [...data.attendanceRecords]
                    .reverse()
                    .map((record) => (
                      <div
                        key={record.date.toISOString()}
                        className="flex min-w-18 flex-col items-center rounded-2xl bg-linear-to-b from-slate-50 to-slate-100 px-3 py-2 border border-slate-200 shadow-xs"
                      >
                        <span className="text-xs font-semibold text-slate-600">
                          {formatDay(record.date)}
                        </span>
                        <span className="mt-2 text-[10px] text-slate-400">
                          {formatDate(record.date)}
                        </span>
                        <span
                          className={`mt-2 h-3 w-3 rounded-full ${statusDotStyles[record.status]}`}
                          aria-label={record.status}
                        />
                      </div>
                    ))
                ) : (
                  <div className="w-full rounded-xl bg-linear-to-r from-slate-50 to-slate-100 px-4 py-5 text-center text-sm text-slate-500 border border-slate-200">
                    {t('parent.dashboard.attendanceEmpty')}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-500">{t('parent.dashboard.termAttendance')}</p>
                  <p className="text-4xl font-bold bg-linear-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                    {data?.attendanceRate || 0}%
                  </p>
                </div>
                <a
                  href="/parent/attendance"
                  className="rounded-full bg-linear-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-shadow"
                >
                  {t('parent.dashboard.viewAttendance')}
                </a>
              </div>
            </>
          )}
        </section>

        {!restrictedFeaturesBlocked && data?.attendanceRecords.length ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {data.attendanceRecords[data.attendanceRecords.length - 1]?.status !== 'PRESENT' && (
              <div className={`rounded-2xl p-4 border-2 ${
                data.attendanceRecords[data.attendanceRecords.length - 1]?.status === 'LATE' 
                  ? 'bg-amber-50 border-amber-200' 
                  : 'bg-rose-50 border-rose-200'
              }`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h3 className={`font-semibold text-sm ${
                      data.attendanceRecords[data.attendanceRecords.length - 1]?.status === 'LATE'
                        ? 'text-amber-900'
                        : 'text-rose-900'
                    }`}>
                      {data.attendanceRecords[data.attendanceRecords.length - 1]?.status === 'LATE'
                        ? 'Child marked Late today'
                        : 'Child marked Absent today'}
                    </h3>
                    <p className={`text-xs mt-1 ${
                      data.attendanceRecords[data.attendanceRecords.length - 1]?.status === 'LATE'
                        ? 'text-amber-700'
                        : 'text-rose-700'
                    }`}>
                      {data.attendanceRecords[data.attendanceRecords.length - 1]?.status === 'LATE'
                        ? 'Please contact the school if this is unexpected.'
                        : 'Please contact the school immediately.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {t('parent.dashboard.assessmentsTitle')}
            </h2>
            {!restrictedFeaturesBlocked ? (
              <a href="/parent/assessments" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                {t('parent.dashboard.viewAssessments')}
              </a>
            ) : null}
          </div>

          {restrictedFeaturesBlocked ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
              {session.user.paymentAccessReason || 'Assessments are unavailable until the school records license coverage for this student.'}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {data?.assessmentNotifications.length ? (
                data.assessmentNotifications.map((assessment) => {
                  const isNew = assessment.createdAt >= announcementCutoff
                  return (
                    <TrackedInteractionLink
                      key={assessment.id}
                      href="/parent/assessments"
                      resourceType="assessment"
                      resourceId={assessment.id}
                      childId={data?.child?.id}
                      metadata={{ section: 'parent-dashboard' }}
                      className="block rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-white p-4 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">
                          {assessment.title}
                        </h3>
                        {isNew ? (
                          <span className="shrink-0 rounded-full bg-linear-to-r from-indigo-100 to-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                            {t('parent.dashboard.newBadge')}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-xs text-slate-600">
                        {assessment.subjectName} • {assessment.term} • {assessment.totalMarks} marks
                      </p>

                      <p className="mt-1 text-[11px] text-slate-500">
                        {assessment.dueDate
                          ? `${t('parent.dashboard.dueDateLabel')}: ${formatDate(assessment.dueDate)}`
                          : t('parent.dashboard.noDueDate')}
                      </p>
                    </TrackedInteractionLink>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-linear-to-br from-slate-50 to-slate-100 p-4 text-center text-sm text-slate-500">
                  <div className="text-2xl">📋</div>
                  <p className="mt-2">{t('parent.dashboard.assessmentsEmpty')}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {restrictedFeaturesBlocked ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {t('parent.dashboard.announcementsTitle')}
              </h2>
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
              {session.user.paymentAccessReason || 'Announcements are unavailable until the school records license coverage for this student.'}
            </div>
          </section>
        ) : data?.announcements.length ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {t('parent.dashboard.announcementsTitle')}
              </h2>
              <a href="/parent/announcements" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                {t('parent.dashboard.viewAnnouncements')}
              </a>
            </div>

            <div className="mt-4 space-y-3">
              {data.announcements.map((announcement) => {
                const isNew = announcement.createdAt >= announcementCutoff
                return (
                  <TrackedInteractionLink
                    key={announcement.id}
                    href="/parent/announcements"
                    resourceType="announcement"
                    resourceId={announcement.id}
                    childId={data?.child?.id}
                    metadata={{
                      section: 'parent-dashboard',
                      announcementType: announcement.type || 'school',
                    }}
                    className={`block rounded-2xl border p-4 shadow-xs ${
                      announcement.type === 'class'
                        ? 'border-emerald-200 bg-linear-to-br from-emerald-50 to-emerald-50'
                        : 'border-slate-200 bg-linear-to-br from-white to-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">
                          {announcement.title}
                        </h3>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
                          announcement.type === 'class'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {announcement.type === 'class' ? '📚 Class' : '🏢 School'}
                        </span>
                      </div>
                      {isNew ? (
                        <span className="shrink-0 rounded-full bg-linear-to-r from-emerald-100 to-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          {t('parent.dashboard.newBadge')}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                      {announcement.message}
                    </p>
                    <p className="mt-2 text-[10px] text-slate-400">
                      {formatDate(announcement.createdAt)}
                    </p>
                  </TrackedInteractionLink>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {t('parent.dashboard.academicTitle')}
            </h2>
            <a href="/parent/results" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              {t('parent.dashboard.viewResults')}
            </a>
          </div>

          {restrictedFeaturesBlocked ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
              {session.user.paymentAccessReason || 'Results are unavailable until the school records license coverage for this student.'}
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-2xl bg-linear-to-br from-slate-50 to-slate-100 p-4 border border-slate-200">
                <p className="text-xs text-slate-500">{t('parent.dashboard.overallAverage')}</p>
                <p className="mt-2 text-4xl font-bold bg-linear-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                  {data?.overallAverage || 0}%
                </p>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500">{t('parent.dashboard.topSubjects')}</p>
                {data?.topSubjects.length ? (
                  <div className="mt-3 space-y-2">
                    {data.topSubjects.map((subject) => (
                      <div
                        key={subject.name}
                        className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-xs border border-slate-100 hover:shadow-sm transition-shadow"
                      >
                        <span className="text-sm text-slate-700">{subject.name}</span>
                        <span className="text-sm font-bold text-emerald-600">
                          {subject.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">{t('parent.dashboard.noResults')}</p>
                )}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">
            {t('parent.dashboard.quickActions')}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <a
              href="/parent/messages"
              className="flex items-center justify-center gap-2 rounded-2xl bg-linear-to-br from-emerald-50 to-emerald-100 px-3 py-3 text-sm font-semibold text-emerald-700 border border-emerald-200 hover:shadow-sm transition-shadow"
            >
              💬 {t('parent.dashboard.messageTeacher')}
            </a>
            {restrictedFeaturesBlocked ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-700">
                📄 Report Locked
              </div>
            ) : (
              <a
                href="/parent/results"
                className="flex items-center justify-center gap-2 rounded-2xl bg-linear-to-br from-slate-100 to-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 border border-slate-300 hover:shadow-sm transition-shadow"
              >
                📄 {t('parent.dashboard.downloadReport')}
              </a>
            )}
          </div>
        </section>
        </div>
      </div>
    </DashboardLayout>
  )
}
