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
import { getChildUpcoming, getParentChildren, resolveSelectedChild } from '@/lib/parent-data'
import { assessmentTypeLabel, formatParentDate, tParent } from '@/lib/parent-i18n'

export default async function ParentUpcomingPage({
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
  const upcoming =
    child && !restricted
      ? await getChildUpcoming(session.user.schoolId, child.classId)
      : []

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
          title={tParent(lang, 'upcomingPageTitle', 'À venir')}
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
            <ParentCard>
              {upcoming.length > 0 ? (
                <div className="ui-table-wrap overflow-x-auto">
                  <table className="ui-table no-table-stripes min-w-full">
                    <thead>
                      <tr>
                        <th>{tParent(lang, 'colTitle', 'Évaluation')}</th>
                        <th>{tParent(lang, 'colSubject', 'Matière')}</th>
                        <th>{tParent(lang, 'colType', 'Type')}</th>
                        <th>{tParent(lang, 'colDue', 'Échéance')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming.map((item) => (
                        <tr key={item.id}>
                          <td className="font-medium ui-text-primary">
                            <div>{item.title}</div>
                            {item.description ? (
                              <p className="mt-0.5 text-xs ui-text-secondary line-clamp-2">
                                {item.description}
                              </p>
                            ) : null}
                          </td>
                          <td>{item.subjectName}</td>
                          <td>
                            <StatusPill tone="neutral">
                              {assessmentTypeLabel(item.type, lang)}
                            </StatusPill>
                          </td>
                          <td>
                            {item.dueDate
                              ? formatParentDate(item.dueDate, lang, true)
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

            <div>
              <Link href="/parent/results" className="ui-table-link text-sm">
                {tParent(lang, 'viewResults', 'Voir les résultats')} →
              </Link>
            </div>
          </>
        )}
      </ParentShell>
    </DashboardLayout>
  )
}
