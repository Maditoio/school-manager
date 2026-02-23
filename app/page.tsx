import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Home() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  // Redirect based on role
  switch (session.user.role) {
    case 'SUPER_ADMIN':
      redirect('/super-admin/dashboard')
    case 'SCHOOL_ADMIN':
      redirect('/admin/dashboard')
    case 'TEACHER':
      redirect('/teacher/dashboard')
    case 'PARENT':
      redirect('/parent/dashboard')
    default:
      redirect('/login')
  }
}
