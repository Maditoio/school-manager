'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'

export default function StudentLibraryPage() {
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
        <div className="text-6xl mb-6">📚</div>
        <h1 className="text-2xl font-bold ui-text-primary mb-2">Bibliothèque</h1>
        <p className="text-sm ui-text-secondary mb-4 max-w-md">
          La bibliothèque numérique sera bientôt accessible. Elle vous permettra de consulter
          des livres, des articles scientifiques et des travaux de recherche directement
          depuis votre espace étudiant.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {[
            '📖 Livres',
            '🔬 Articles scientifiques',
            '📄 Travaux de recherche',
            '🎓 Ressources pédagogiques',
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
