'use client'

import { SessionProvider } from 'next-auth/react'
import { Session } from 'next-auth'
import { ToastProvider } from '@/components/ui/Toast'
import { LocaleProvider } from '@/lib/locale-context'

export function Providers({ 
  children, 
  session 
}: { 
  children: React.ReactNode
  session: Session | null
}) {
  return (
    <SessionProvider session={session}>
      <LocaleProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </LocaleProvider>
    </SessionProvider>
  )
}
