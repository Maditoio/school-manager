'use client'

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useEffect } from 'react'
import { MeetingAgendaView } from '@/components/meeting-agenda/MeetingAgendaView'
import {
  ADMIN_NAV_ITEMS,
  DEPUTY_ADMIN_NAV_ITEMS,
  FINANCE_NAV_ITEMS,
  FINANCE_MANAGER_NAV_ITEMS,
} from '@/lib/admin-nav'

const ADMIN_FINANCE_ROLES = ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE', 'FINANCE_MANAGER']

export default function AdminMeetingAgendaPage() {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role === 'TEACHER') {
      redirect('/teacher/meeting-agenda')
    }
  }, [session, status])

  if (status === 'loading' || !session?.user) return <div>Loading...</div>
  if (session.user.role === 'TEACHER') return <div>Loading...</div>

  const role = session.user.role
  const navItems =
    role === 'FINANCE_MANAGER'
      ? FINANCE_MANAGER_NAV_ITEMS
      : role === 'FINANCE'
        ? FINANCE_NAV_ITEMS
        : role === 'DEPUTY_ADMIN'
          ? DEPUTY_ADMIN_NAV_ITEMS
          : ADMIN_NAV_ITEMS

  return (
    <MeetingAgendaView
      navItems={navItems}
      allowedRoles={ADMIN_FINANCE_ROLES}
      unauthorizedRedirect="/admin/dashboard"
    />
  )
}
