import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LandingPage from './components/landing-page'

export default async function Home() {
  const session = await auth()

  // If user is authenticated, redirect to their dashboard
  if (session?.user) {
    switch (session.user.role) {
      case 'SUPER_ADMIN':
        redirect('/super-admin/dashboard')
      case 'SCHOOL_ADMIN':
      case 'DEPUTY_ADMIN':
        redirect('/admin/dashboard')
      case 'FINANCE':
        redirect('/finance/fees')
      case 'FINANCE_MANAGER':
        redirect('/finance/expenses')
      case 'TEACHER':
        redirect('/teacher/dashboard')
      case 'PARENT':
        redirect('/parent/dashboard')
      case 'STUDENT':
        redirect(session.user.paymentAccessBlocked ? '/student/fees' : '/student/dashboard')
      default:
        redirect('/login')
    }
  }

  // If not authenticated, show landing page
  return <LandingPage />
}
