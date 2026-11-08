import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  ParentCard,
  ParentPageHeader,
  ParentShell,
} from '@/components/parent/ParentShell'
import { PARENT_NAV_ITEMS } from '@/lib/admin-nav'
import { getParentChildren } from '@/lib/parent-data'
import { formatParentDate, genderLabel, tParent } from '@/lib/parent-i18n'

export default async function ParentChildrenPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'PARENT') {
    redirect('/login')
  }

  const lang = session.user.preferredLanguage || 'fr'
  const children = await getParentChildren(session.user.id, session.user.schoolId)

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
          title={tParent(lang, 'childrenTitle', 'Mes enfants')}
          subtitle={tParent(lang, 'childrenSubtitle', 'Informations sur vos enfants')}
        />

        {children.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {children.map((child) => (
              <ParentCard key={child.id}>
                <p className="text-sm font-semibold ui-text-primary">{child.name}</p>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="ui-text-secondary">
                      {tParent(lang, 'admissionNo', "N° d'admission")}
                    </dt>
                    <dd className="font-medium ui-text-primary">
                      {child.admissionNumber || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="ui-text-secondary">
                      {tParent(lang, 'classLabel', 'Classe')}
                    </dt>
                    <dd className="font-medium ui-text-primary">{child.className}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="ui-text-secondary">
                      {tParent(lang, 'dateOfBirth', 'Date de naissance')}
                    </dt>
                    <dd className="font-medium ui-text-primary">
                      {child.dateOfBirth
                        ? formatParentDate(child.dateOfBirth, lang)
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="ui-text-secondary">
                      {tParent(lang, 'gender', 'Genre')}
                    </dt>
                    <dd className="font-medium ui-text-primary">
                      {genderLabel(child.gender, lang)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/parent/results?childId=${child.id}`}
                    className="ui-table-link text-sm"
                  >
                    {tParent(lang, 'viewResults', 'Voir les résultats')} →
                  </Link>
                  <Link
                    href={`/parent/attendance?childId=${child.id}`}
                    className="ui-table-link text-sm"
                  >
                    {tParent(lang, 'viewAttendance', 'Voir les présences')} →
                  </Link>
                </div>
              </ParentCard>
            ))}
          </div>
        ) : (
          <ParentCard>
            <p className="text-sm ui-text-secondary">
              {tParent(lang, 'noChild', 'Aucun enfant lié à votre compte.')}
            </p>
          </ParentCard>
        )}
      </ParentShell>
    </DashboardLayout>
  )
}
