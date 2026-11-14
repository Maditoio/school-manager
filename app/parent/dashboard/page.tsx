import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ParentCard, ParentPageHeader, ParentSectionHeader, ParentShell } from '@/components/parent/ParentShell'
import { StatusPill } from '@/components/admin/detail'
import { PARENT_NAV_ITEMS } from '@/lib/admin-nav'
import { attendanceLabel, attendanceTone, formatParentDate, tParent } from '@/lib/parent-i18n'
import { prisma } from '@/lib/prisma'
import { calculateAttendancePercentage } from '@/lib/utils'

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE'

type DashboardData = {
  children: Array<{ id: string; name: string; className: string }>
  child: { id: string; name: string; className: string } | null
  attendanceRecords: Array<{ date: Date; status: AttendanceStatus }>
  attendanceRate: number
  announcements: Array<{
    id: string
    title: string
    message: string
    imageUrl: string | null
    createdAt: Date
    type: 'school' | 'class'
  }>
  upcoming: Array<{
    id: string
    title: string
    subjectName: string
    dueDate: Date | null
    type: string
  }>
  recentResults: Array<{
    id: string
    title: string
    subjectName: string
    score: number
    totalMarks: number
    percent: number
  }>
  overallAverage: number
  unreadMessagesCount: number
}

async function getDashboardData(parentId: string, schoolId: string | null): Promise<DashboardData> {
  const empty: DashboardData = {
    children: [],
    child: null,
    attendanceRecords: [],
    attendanceRate: 0,
    announcements: [],
    upcoming: [],
    recentResults: [],
    overallAverage: 0,
    unreadMessagesCount: 0,
  }

  try {
    const childrenRows = await prisma.student.findMany({
      where: {
        parentId,
        ...(schoolId ? { schoolId } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        classId: true,
        class: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const children = childrenRows.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      className: c.class?.name || '—',
    }))

    const primaryChild = childrenRows[0]
    if (!primaryChild) return empty

    const now = new Date()

    const [
      attendanceRecords,
      totalAttendanceCount,
      presentAttendanceCount,
      schoolAnnouncements,
      classAnnouncements,
      upcomingAssessments,
      gradedAssessments,
      unreadMessagesCount,
    ] = await Promise.all([
      prisma.attendance.findMany({
        where: { studentId: primaryChild.id },
        orderBy: { date: 'desc' },
        take: 7,
        select: { date: true, status: true },
      }),
      prisma.attendance.count({ where: { studentId: primaryChild.id } }),
      prisma.attendance.count({ where: { studentId: primaryChild.id, status: 'PRESENT' } }),
      prisma.announcement.findMany({
        where: { schoolId: schoolId || undefined },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { id: true, title: true, message: true, imageUrl: true, createdAt: true },
      }),
      prisma.classAnnouncement.findMany({
        where: {
          schoolId: schoolId || undefined,
          classId: primaryChild.classId,
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { id: true, title: true, message: true, createdAt: true },
      }),
      prisma.assessment.findMany({
        where: {
          schoolId: schoolId || undefined,
          classId: primaryChild.classId,
          published: true,
          OR: [{ dueDate: { gte: now } }, { dueDate: null, createdAt: { gte: new Date(now.getTime() - 14 * 86400000) } }],
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 5,
        select: {
          id: true,
          title: true,
          dueDate: true,
          type: true,
          subject: { select: { name: true } },
        },
      }),
      prisma.studentAssessment.findMany({
        where: {
          studentId: primaryChild.id,
          graded: true,
          score: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          score: true,
          assessment: {
            select: {
              title: true,
              totalMarks: true,
              subject: { select: { name: true } },
            },
          },
        },
      }),
      prisma.message.count({
        where: {
          schoolId: schoolId || undefined,
          receiverId: parentId,
          read: false,
        },
      }),
    ])

    const announcements = [
      ...schoolAnnouncements.map((a) => ({ ...a, type: 'school' as const })),
      ...classAnnouncements.map((a) => ({ ...a, imageUrl: null as string | null, type: 'class' as const })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 4)

    let overallTotal = 0
    let overallCount = 0
    const recentResults = gradedAssessments.map((item) => {
      const totalMarks = item.assessment.totalMarks || 1
      const score = item.score || 0
      const percent = Math.round((score / totalMarks) * 100)
      overallTotal += percent
      overallCount += 1
      return {
        id: item.id,
        title: item.assessment.title,
        subjectName: item.assessment.subject.name,
        score,
        totalMarks,
        percent,
      }
    })

    // Full average from all graded (not only recent 5)
    const allGraded = await prisma.studentAssessment.findMany({
      where: { studentId: primaryChild.id, graded: true, score: { not: null } },
      select: {
        score: true,
        assessment: { select: { totalMarks: true } },
      },
    })
    let avgTotal = 0
    let avgCount = 0
    for (const item of allGraded) {
      const max = item.assessment.totalMarks || 1
      avgTotal += ((item.score || 0) / max) * 100
      avgCount += 1
    }

    return {
      children,
      child: {
        id: primaryChild.id,
        name: `${primaryChild.firstName} ${primaryChild.lastName}`.trim(),
        className: primaryChild.class?.name || '—',
      },
      attendanceRecords: attendanceRecords as Array<{ date: Date; status: AttendanceStatus }>,
      attendanceRate: calculateAttendancePercentage(presentAttendanceCount, totalAttendanceCount),
      announcements,
      upcoming: upcomingAssessments.map((a) => ({
        id: a.id,
        title: a.title,
        subjectName: a.subject.name,
        dueDate: a.dueDate,
        type: a.type,
      })),
      recentResults,
      overallAverage: avgCount > 0 ? Math.round(avgTotal / avgCount) : overallCount > 0 ? Math.round(overallTotal / overallCount) : 0,
      unreadMessagesCount,
    }
  } catch (error) {
    console.error('Error getting parent dashboard data:', error)
    return empty
  }
}

export default async function ParentDashboard() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'PARENT') {
    redirect('/login')
  }

  const lang = session.user.preferredLanguage || 'fr'
  const data = await getDashboardData(session.user.id, session.user.schoolId)
  const restricted = Boolean(session.user.paymentAccessBlocked)
  const latestAttendance = data.attendanceRecords[0]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Parent',
        role: 'Parent',
        email: session.user.email,
      }}
      navItems={PARENT_NAV_ITEMS}
    >
      <ParentShell>
        <ParentPageHeader
          title={tParent(lang, 'welcomeTitle', 'Espace parent')}
          subtitle={
            data.child
              ? `${data.child.name} · ${data.child.className}`
              : tParent(lang, 'noChild', 'Aucun enfant lié à votre compte.')
          }
          actions={
            data.unreadMessagesCount > 0 ? (
              <Link href="/parent/messages" className="ui-table-link text-sm">
                {data.unreadMessagesCount} {tParent(lang, 'unreadMessages', 'message(s) non lu(s)')} →
              </Link>
            ) : null
          }
        />

        {!data.child ? (
          <ParentCard>
            <p className="text-sm ui-text-secondary">
              {tParent(lang, 'contactSchool', "Veuillez contacter l'administrateur de l'école.")}
            </p>
          </ParentCard>
        ) : (
          <>
            {restricted ? (
              <ParentCard className="border-[color-mix(in_srgb,var(--danger)_25%,var(--border-subtle))]">
                <p className="text-sm ui-text-secondary">
                  {session.user.paymentAccessReason ||
                    tParent(
                      lang,
                      'featuresLocked',
                      'Certaines informations sont indisponibles jusqu’à la régularisation de la licence.'
                    )}
                </p>
              </ParentCard>
            ) : null}

            {latestAttendance && latestAttendance.status !== 'PRESENT' ? (
              <ParentCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold ui-text-primary">
                      {latestAttendance.status === 'LATE'
                        ? tParent(lang, 'markedLate', 'Enfant marqué en retard')
                        : tParent(lang, 'markedAbsent', 'Enfant marqué absent')}
                    </p>
                    <p className="mt-1 text-xs ui-text-secondary">
                      {formatParentDate(latestAttendance.date, lang)} ·{' '}
                      {tParent(lang, 'contactIfUnexpected', 'Contactez l’école si cela est inattendu.')}
                    </p>
                  </div>
                  <StatusPill tone={attendanceTone(latestAttendance.status)}>
                    {attendanceLabel(latestAttendance.status, lang)}
                  </StatusPill>
                </div>
              </ParentCard>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ParentCard>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
                  {tParent(lang, 'termAttendance', 'Présence')}
                </p>
                <p className="mt-2 text-[1.375rem] font-semibold ui-text-primary">
                  {restricted ? '—' : `${data.attendanceRate}%`}
                </p>
              </ParentCard>
              <ParentCard>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
                  {tParent(lang, 'overallAverage', 'Moyenne')}
                </p>
                <p className="mt-2 text-[1.375rem] font-semibold ui-text-primary">
                  {restricted ? '—' : `${data.overallAverage}%`}
                </p>
              </ParentCard>
              <ParentCard>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
                  {tParent(lang, 'upcomingCount', 'À venir')}
                </p>
                <p className="mt-2 text-[1.375rem] font-semibold ui-text-primary">
                  {restricted ? '—' : data.upcoming.length}
                </p>
              </ParentCard>
            </div>

            <ParentCard>
              <ParentSectionHeader
                title={tParent(lang, 'upcomingTitle', 'À venir')}
                href="/parent/upcoming"
                linkLabel={tParent(lang, 'viewAll', 'Tout voir')}
              />
              {restricted ? (
                <p className="text-sm ui-text-secondary">{tParent(lang, 'sectionLocked', 'Section indisponible.')}</p>
              ) : data.upcoming.length > 0 ? (
                <div className="ui-table-wrap overflow-x-auto">
                  <table className="ui-table no-table-stripes min-w-full">
                    <thead>
                      <tr>
                        <th>{tParent(lang, 'colTitle', 'Évaluation')}</th>
                        <th>{tParent(lang, 'colSubject', 'Matière')}</th>
                        <th>{tParent(lang, 'colDue', 'Échéance')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.upcoming.map((item) => (
                        <tr key={item.id}>
                          <td className="font-medium ui-text-primary">{item.title}</td>
                          <td>{item.subjectName}</td>
                          <td>
                            {item.dueDate
                              ? formatParentDate(item.dueDate, lang)
                              : tParent(lang, 'noDueDate', 'Sans date')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm ui-text-secondary">
                  {tParent(lang, 'upcomingEmpty', 'Rien de prévu pour le moment.')}
                </p>
              )}
            </ParentCard>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ParentCard>
                <ParentSectionHeader
                  title={tParent(lang, 'recentResultsTitle', 'Résultats récents')}
                  href="/parent/results"
                  linkLabel={tParent(lang, 'viewResults', 'Voir les résultats')}
                />
                {restricted ? (
                  <p className="text-sm ui-text-secondary">{tParent(lang, 'sectionLocked', 'Section indisponible.')}</p>
                ) : data.recentResults.length > 0 ? (
                  <div className="space-y-2">
                    {data.recentResults.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-center justify-between gap-3 rounded-[6px] border border-(--border-subtle) bg-(--surface-soft) px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium ui-text-primary">{result.title}</p>
                          <p className="text-xs ui-text-secondary">{result.subjectName}</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold ui-text-primary">
                          {result.score}/{result.totalMarks}
                          <span className="ml-1 text-xs ui-text-secondary">({result.percent}%)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm ui-text-secondary">
                    {tParent(lang, 'noResults', 'Aucun résultat disponible.')}
                  </p>
                )}
              </ParentCard>

              <ParentCard>
                <ParentSectionHeader
                  title={tParent(lang, 'attendanceTitle', 'Présences récentes')}
                  href="/parent/attendance"
                  linkLabel={tParent(lang, 'viewAttendance', 'Voir les présences')}
                />
                {restricted ? (
                  <p className="text-sm ui-text-secondary">{tParent(lang, 'sectionLocked', 'Section indisponible.')}</p>
                ) : data.attendanceRecords.length > 0 ? (
                  <div className="ui-table-wrap overflow-x-auto">
                    <table className="ui-table no-table-stripes min-w-full">
                      <thead>
                        <tr>
                          <th>{tParent(lang, 'colDate', 'Date')}</th>
                          <th>{tParent(lang, 'colStatus', 'Statut')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.attendanceRecords.map((record) => (
                          <tr key={record.date.toISOString()}>
                            <td>{formatParentDate(record.date, lang)}</td>
                            <td>
                              <StatusPill tone={attendanceTone(record.status)}>
                                {attendanceLabel(record.status, lang)}
                              </StatusPill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm ui-text-secondary">
                    {tParent(lang, 'attendanceEmpty', 'Aucune présence enregistrée.')}
                  </p>
                )}
              </ParentCard>
            </div>

            <ParentCard>
              <ParentSectionHeader
                title={tParent(lang, 'announcementsTitle', 'Annonces')}
                href="/parent/announcements"
                linkLabel={tParent(lang, 'viewAnnouncements', 'Voir les annonces')}
              />
              {data.announcements.length > 0 ? (
                <div className="space-y-2">
                  {data.announcements.map((announcement) => (
                    <Link
                      key={`${announcement.type}-${announcement.id}`}
                      href="/parent/announcements"
                      className="block rounded-[6px] border border-(--border-subtle) bg-(--surface-soft) px-3 py-2.5 transition-colors hover:bg-(--field-bg)"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium ui-text-primary">{announcement.title}</p>
                            <StatusPill tone={announcement.type === 'class' ? 'pending' : 'neutral'}>
                              {announcement.type === 'class'
                                ? tParent(lang, 'classBadge', 'Classe')
                                : tParent(lang, 'schoolBadge', 'École')}
                            </StatusPill>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs ui-text-secondary">{announcement.message}</p>
                          <p className="mt-1 text-[0.6875rem] ui-text-secondary">
                            {formatParentDate(announcement.createdAt, lang)}
                          </p>
                        </div>
                        {announcement.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={announcement.imageUrl}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-[6px] object-cover"
                          />
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm ui-text-secondary">
                  {tParent(lang, 'announcementsEmpty', 'Aucune annonce disponible.')}
                </p>
              )}
            </ParentCard>
          </>
        )}
      </ParentShell>
    </DashboardLayout>
  )
}
