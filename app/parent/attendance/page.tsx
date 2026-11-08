import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  ParentCard,
  ParentPageHeader,
  ParentShell,
} from '@/components/parent/ParentShell'
import { ChildSelectControl } from '@/components/parent/ChildSelectControl'
import { StatusPill } from '@/components/admin/detail'
import { PARENT_NAV_ITEMS } from '@/lib/admin-nav'
import { getChildAttendance, getParentChildren, resolveSelectedChild } from '@/lib/parent-data'
import { attendanceLabel, attendanceTone, formatParentDate, tParent } from '@/lib/parent-i18n'

export default async function ParentAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ childId?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'PARENT') {
    redirect('/login')
  }

  const params = await searchParams
  const lang = session.user.preferredLanguage || 'fr'
  const restricted = Boolean(session.user.paymentAccessBlocked)
  const children = await getParentChildren(session.user.id, session.user.schoolId)
  const child = resolveSelectedChild(children, params.childId)
  const attendance =
    child && !restricted
      ? await getChildAttendance(child.id)
      : { records: [], rate: 0, totalCount: 0, presentCount: 0 }

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
          title={tParent(lang, 'attendancePageTitle', 'Présences')}
          subtitle={
            child
              ? `${child.name} · ${child.className}`
              : tParent(lang, 'noChild', 'Aucun enfant lié à votre compte.')
          }
          actions={
            <Suspense fallback={null}>
              <ChildSelectControl
                childrenOptions={children.map((c) => ({
                  id: c.id,
                  label: `${c.name} · ${c.className}`,
                }))}
                value={child?.id || ''}
                label={tParent(lang, 'selectChild', 'Enfant')}
              />
            </Suspense>
          }
        />

        {!child ? (
          <ParentCard>
            <p className="text-sm ui-text-secondary">
              {tParent(lang, 'contactSchool', "Veuillez contacter l'administrateur de l'école.")}
            </p>
          </ParentCard>
        ) : restricted ? (
          <ParentCard>
            <p className="text-sm ui-text-secondary">
              {session.user.paymentAccessReason ||
                tParent(lang, 'sectionLocked', 'Section indisponible.')}
            </p>
            <Link href="/parent/dashboard" className="ui-table-link mt-3 inline-block text-sm">
              {tParent(lang, 'backHome', "Retour à l'accueil")} →
            </Link>
          </ParentCard>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ParentCard>
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
                  {tParent(lang, 'termAttendance', 'Présence')}
                </p>
                <p className="mt-2 text-[22px] font-semibold ui-text-primary">
                  {attendance.rate}%
                </p>
              </ParentCard>
              <ParentCard>
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
                  {tParent(lang, 'present', 'Présent')}
                </p>
                <p className="mt-2 text-[22px] font-semibold ui-text-primary">
                  {attendance.presentCount}
                </p>
              </ParentCard>
              <ParentCard>
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
                  {tParent(lang, 'recordsCount', 'Enregistrements')}
                </p>
                <p className="mt-2 text-[22px] font-semibold ui-text-primary">
                  {attendance.totalCount}
                </p>
              </ParentCard>
            </div>

            <ParentCard>
              {attendance.records.length > 0 ? (
                <div className="ui-table-wrap overflow-x-auto">
                  <table className="ui-table no-table-stripes min-w-full">
                    <thead>
                      <tr>
                        <th>{tParent(lang, 'colDate', 'Date')}</th>
                        <th>{tParent(lang, 'colStatus', 'Statut')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.records.map((record) => (
                        <tr key={record.id}>
                          <td>{formatParentDate(record.date, lang, true)}</td>
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
          </>
        )}
      </ParentShell>
    </DashboardLayout>
  )
}
