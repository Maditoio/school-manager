'use client'

import { SessionProvider } from 'next-auth/react'
import { Session } from 'next-auth'
import { ToastProvider } from '@/components/ui/Toast'
import { LocaleProvider } from '@/lib/locale-context'
import { ConfirmDialogProvider } from '@/lib/useConfirmDialog'

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
        <ConfirmDialogProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ConfirmDialogProvider>
      </LocaleProvider>
    </SessionProvider>
  )
}
