'use client'

import { SessionProvider } from 'next-auth/react'
import { Session } from 'next-auth'
import { ToastProvider } from '@/components/ui/Toast'
import { LocaleProvider } from '@/lib/locale-context'
import { CurrencyProvider } from '@/lib/currency-context'
import { ConfirmDialogProvider } from '@/lib/useConfirmDialog'
import { AlertDialogProvider } from '@/lib/useAlertDialog'

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
        <CurrencyProvider>
          <ConfirmDialogProvider>
            <AlertDialogProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </AlertDialogProvider>
          </ConfirmDialogProvider>
        </CurrencyProvider>
      </LocaleProvider>
    </SessionProvider>
  )
}
