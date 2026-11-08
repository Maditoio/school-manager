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
import {
  getChildAnnouncements,
  getParentChildren,
  resolveSelectedChild,
} from '@/lib/parent-data'
import { formatParentDate, tParent } from '@/lib/parent-i18n'

type SearchParams = Promise<{ childId?: string }> | { childId?: string }

export default async function ParentAnnouncementsPage({
  searchParams,
}: {
  searchParams: SearchParams
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
  const announcements =
    child && !restricted
      ? await getChildAnnouncements(session.user.schoolId, child.classId)
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
          title={tParent(lang, 'announcementsPageTitle', 'Annonces')}
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
        ) : announcements.length > 0 ? (
          <div className="space-y-3">
            {announcements.map((announcement) => {
              const creatorName = announcement.creator
                ? `${announcement.creator.firstName || ''} ${announcement.creator.lastName || ''}`.trim()
                : ''
              return (
                <ParentCard key={`${announcement.type}-${announcement.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold ui-text-primary">{announcement.title}</p>
                      {creatorName ? (
                        <p className="mt-0.5 text-xs ui-text-secondary">
                          {creatorName}
                          {announcement.className ? ` · ${announcement.className}` : ''}
                        </p>
                      ) : null}
                    </div>
                    <StatusPill tone={announcement.type === 'class' ? 'pending' : 'neutral'}>
                      {announcement.type === 'class'
                        ? tParent(lang, 'classBadge', 'Classe')
                        : tParent(lang, 'schoolBadge', 'École')}
                    </StatusPill>
                  </div>
                  {announcement.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={announcement.imageUrl}
                      alt={announcement.title}
                      className="mt-3 h-44 w-full rounded-[6px] object-cover"
                    />
                  ) : null}
                  <p className="mt-2 text-sm ui-text-secondary whitespace-pre-wrap">
                    {announcement.message}
                  </p>
                  <p className="mt-2 text-[11px] ui-text-secondary">
                    {formatParentDate(announcement.createdAt, lang, true)}
                  </p>
                </ParentCard>
              )
            })}
          </div>
        ) : (
          <ParentCard>
            <p className="text-sm ui-text-secondary">
              {tParent(lang, 'announcementsEmpty', 'Aucune annonce disponible.')}
            </p>
          </ParentCard>
        )}
      </ParentShell>
    </DashboardLayout>
  )
}
