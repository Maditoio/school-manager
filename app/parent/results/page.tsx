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
import { PARENT_NAV_ITEMS } from '@/lib/admin-nav'
import { getChildResults, getParentChildren, resolveSelectedChild } from '@/lib/parent-data'
import { formatParentDate, tParent } from '@/lib/parent-i18n'

export default async function ParentResultsPage({
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
  const results = child && !restricted ? await getChildResults(child.id) : []
  const average =
    results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.percent, 0) / results.length)
      : 0

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
          title={tParent(lang, 'resultsTitle', 'Résultats')}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ParentCard>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
                  {tParent(lang, 'overallAverage', 'Moyenne')}
                </p>
                <p className="mt-2 text-[1.375rem] font-semibold ui-text-primary">{average}%</p>
              </ParentCard>
              <ParentCard>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
                  {tParent(lang, 'gradedCount', 'Évaluations notées')}
                </p>
                <p className="mt-2 text-[1.375rem] font-semibold ui-text-primary">{results.length}</p>
              </ParentCard>
            </div>

            <ParentCard>
              {results.length > 0 ? (
                <div className="ui-table-wrap overflow-x-auto">
                  <table className="ui-table no-table-stripes min-w-full">
                    <thead>
                      <tr>
                        <th>{tParent(lang, 'colTitle', 'Évaluation')}</th>
                        <th>{tParent(lang, 'colSubject', 'Matière')}</th>
                        <th>{tParent(lang, 'colScore', 'Note')}</th>
                        <th>{tParent(lang, 'colPercent', '%')}</th>
                        <th>{tParent(lang, 'colDate', 'Date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result) => (
                        <tr key={result.id}>
                          <td className="font-medium ui-text-primary">
                            <div>{result.title}</div>
                            {result.feedback ? (
                              <p className="mt-0.5 text-xs ui-text-secondary line-clamp-2">
                                {result.feedback}
                              </p>
                            ) : null}
                          </td>
                          <td>{result.subjectName}</td>
                          <td className="font-semibold">
                            {result.score}/{result.totalMarks}
                          </td>
                          <td className="font-semibold">{result.percent}%</td>
                          <td>
                            {result.date
                              ? formatParentDate(result.date, lang)
                              : tParent(lang, 'noDueDate', 'Sans date')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm ui-text-secondary">
                  {tParent(lang, 'noResults', 'Aucun résultat disponible.')}
                </p>
              )}
            </ParentCard>

            <div>
              <Link href="/parent/upcoming" className="ui-table-link text-sm">
                {tParent(lang, 'viewUpcoming', 'Voir les évaluations à venir')} →
              </Link>
            </div>
          </>
        )}
      </ParentShell>
    </DashboardLayout>
  )
}
