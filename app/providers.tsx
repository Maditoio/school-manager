'use client'

import { SessionProvider } from 'next-auth/react'
import { Session } from 'next-auth'
import { ToastProvider } from '@/components/ui/Toast'

export function Providers({ 
  children, 
  session 
}: { 
  children: React.ReactNode
  session: Session | null
}) {
  return (
    <SessionProvider session={session}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </SessionProvider>
  )
}
