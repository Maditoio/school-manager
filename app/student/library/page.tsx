'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { STUDENT_NAV_ITEMS } from '@/lib/admin-nav'
import { useStudentUi } from '@/lib/use-student-ui'

export default function StudentLibraryPage() {
  const { data: session, status } = useSession()
  const { tStudent } = useStudentUi()

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'STUDENT') redirect('/login')
  }, [session, status])

  if (status === 'loading' || !session) return null

  const featureChips = [
    { emoji: '📖', label: tStudent('libraryBooks', 'Books') },
    { emoji: '🔬', label: tStudent('libraryArticles', 'Scientific articles') },
    { emoji: '📄', label: tStudent('libraryResearch', 'Research papers') },
    { emoji: '🎓', label: tStudent('libraryResources', 'Teaching resources') },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Student',
        role: 'Student',
        email: session.user.email,
      }}
      navItems={STUDENT_NAV_ITEMS}
    >
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-6xl mb-6">📚</div>
        <h1 className="text-2xl font-bold ui-text-primary mb-2">
          {tStudent('libraryTitle', 'Library')}
        </h1>
        <p className="text-sm ui-text-secondary mb-4 max-w-md">
          {tStudent(
            'librarySubtitle',
            'The digital library will be available soon. You will be able to browse books, scientific articles, and research papers from your student space.'
          )}
        </p>
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {featureChips.map(item => (
            <span
              key={item.label}
              className="inline-flex items-center rounded-lg border ui-border px-3 py-1.5 text-xs font-medium ui-text-secondary"
            >
              {item.emoji} {item.label}
            </span>
          ))}
        </div>
        <span className="inline-flex items-center rounded-full border ui-border px-4 py-1.5 text-sm font-medium ui-text-secondary">
          {tStudent('comingSoon', 'Coming soon')}
        </span>
      </div>
    </DashboardLayout>
  )
}
