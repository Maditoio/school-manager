import { redirect } from 'next/navigation'

/** Admin meeting agenda is retired — deep links go to the dashboard. */
export default function AdminMeetingAgendaPage() {
  redirect('/admin/dashboard')
}
