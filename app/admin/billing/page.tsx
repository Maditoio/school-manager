'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import { useAdminUi } from '@/lib/use-admin-ui'

export default function BillingManagementPage() {
  const { data: session, status } = useSession()
  const { tAdmin } = useAdminUi()

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (
      status === 'authenticated' &&
      !['SCHOOL_ADMIN', 'DEPUTY_ADMIN'].includes(session?.user?.role ?? '')
    ) {
      redirect('/login')
    }
  }, [session, status])

  if (status === 'loading' || !session) return null

  const navItems =
    session.user.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session.user.role,
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <p className="text-[1.25rem] font-semibold ui-text-primary">
          {tAdmin('comingSoon', 'Coming soon')}
        </p>
      </div>
    </DashboardLayout>
  )
}
