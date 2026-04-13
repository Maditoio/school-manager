'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import AlertDialog, { type AlertDialogVariant } from '@/components/ui/AlertDialog'

interface AlertOptions {
  title: string
  message: string
  variant?: AlertDialogVariant
  okLabel?: string
}

interface AlertDialogContextValue {
  showAlert: (options: AlertOptions) => Promise<void>
}

type PendingState = {
  id: number
  options: AlertOptions
  resolve: () => void
} | null

const AlertDialogContext = createContext<AlertDialogContextValue | undefined>(undefined)

export function AlertDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingState>(null)
  const [isClosing, setIsClosing] = useState(false)
  const closeTimerRef = useRef<number | null>(null)
  const requestCounterRef = useRef(0)

  const closeDialog = useCallback(() => {
    setIsClosing(true)
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = window.setTimeout(() => {
      setPending(null)
      setIsClosing(false)
    }, 180)
  }, [])

  const showAlert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise<void>((resolve) => {
      setIsClosing(false)
      requestCounterRef.current += 1
      setPending({ id: requestCounterRef.current, options, resolve })
    })
  }, [])

  const handleClose = useCallback(() => {
    if (!pending) return
    pending.resolve()
    closeDialog()
  }, [pending, closeDialog])

  const value = useMemo(() => ({ showAlert }), [showAlert])

  return (
    <AlertDialogContext.Provider value={value}>
      {children}
      {pending ? (
        <AlertDialog
          key={pending.id}
          isOpen={!isClosing}
          isClosing={isClosing}
          title={pending.options.title}
          message={pending.options.message}
          variant={pending.options.variant}
          okLabel={pending.options.okLabel}
          onClose={handleClose}
        />
      ) : null}
    </AlertDialogContext.Provider>
  )
}

export function useAlert() {
  const context = useContext(AlertDialogContext)
  if (!context) {
    throw new Error('useAlert must be used within AlertDialogProvider')
  }
  return context
}
