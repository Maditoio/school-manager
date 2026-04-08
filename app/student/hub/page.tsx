'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'

export default function StudentHubPage() {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'STUDENT') redirect('/login')
  }, [session, status])

  if (status === 'loading' || !session) return null

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Étudiant',
        role: 'Étudiant',
        email: session.user.email,
      }}
      navItems={STUDENT_NAV_ITEMS}
    >
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-6xl mb-6">🚀</div>
        <h1 className="text-2xl font-bold ui-text-primary mb-2">Espace Étudiant</h1>
        <p className="text-sm ui-text-secondary mb-6 max-w-md">
          Votre espace personnel centralisé arrive bientôt. Retrouvez ici vos devoirs,
          emplois du temps, notifications et bien plus encore.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {[
            '📋 Devoirs & exercices',
            '🗓️ Emploi du temps',
            '🔔 Notifications',
            '🏆 Classements',
          ].map(item => (
            <span
              key={item}
              className="inline-flex items-center rounded-lg border ui-border px-3 py-1.5 text-xs font-medium ui-text-secondary"
            >
              {item}
            </span>
          ))}
        </div>
        <span className="inline-flex items-center rounded-full border ui-border px-4 py-1.5 text-sm font-medium ui-text-secondary">
          Bientôt disponible
        </span>
      </div>
    </DashboardLayout>
  )
}
