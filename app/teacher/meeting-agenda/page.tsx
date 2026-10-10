'use client'

import { MeetingAgendaView } from '@/components/meeting-agenda/MeetingAgendaView'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'

const TEACHER_AGENDA_ROLES = ['TEACHER']

export default function TeacherMeetingAgendaPage() {
  return (
    <MeetingAgendaView
      navItems={TEACHER_NAV_ITEMS}
      allowedRoles={TEACHER_AGENDA_ROLES}
      unauthorizedRedirect="/teacher/dashboard"
    />
  )
}
