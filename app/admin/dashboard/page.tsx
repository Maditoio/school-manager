import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardPage from './DashboardPage'

export default async function AdminDashboard() {
  const session = await auth()

  if (!session?.user || (session.user.role !== 'SCHOOL_ADMIN' && session.user.role !== 'DEPUTY_ADMIN')) {
    redirect('/login')
  }

  const user = {
    name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
    role: session.user.role === 'DEPUTY_ADMIN' ? 'Deputy Admin' : 'School Admin',
    email: session.user.email,
  }

  return <DashboardPage user={user} />
}
