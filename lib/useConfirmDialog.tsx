'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import ConfirmDialog, { type ConfirmDialogEntity, type ConfirmDialogVariant } from '@/components/ui/ConfirmDialog'

interface ConfirmOptions {
  title: string
  description: string
  variant?: ConfirmDialogVariant
  confirmLabel?: string
  cancelLabel?: string
  loadingLabel?: string
  entity?: ConfirmDialogEntity
  requireInput?: string
  allowBackdropClose?: boolean
  allowEscapeClose?: boolean
  onConfirm?: () => void | Promise<void>
}

interface ConfirmDialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

type PendingState = {
  id: number
  options: ConfirmOptions
  resolve: (value: boolean) => void
} | null

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | undefined>(undefined)

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
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

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setIsClosing(false)
      requestCounterRef.current += 1
      setPending({ id: requestCounterRef.current, options, resolve })
    })
  }, [])

  const handleClose = useCallback(() => {
    if (!pending) return
    pending.resolve(false)
    closeDialog()
  }, [pending, closeDialog])

  const handleConfirm = useCallback(async () => {
    if (!pending) return

    if (pending.options.onConfirm) {
      await pending.options.onConfirm()
    }

    pending.resolve(true)
    closeDialog()
  }, [pending, closeDialog])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {pending ? (
        <ConfirmDialog
          key={pending.id}
          isOpen={!isClosing}
          isClosing={isClosing}
          title={pending.options.title}
          description={pending.options.description}
          variant={pending.options.variant}
          confirmLabel={pending.options.confirmLabel}
          cancelLabel={pending.options.cancelLabel}
          loadingLabel={pending.options.loadingLabel}
          entity={pending.options.entity}
          requireInput={pending.options.requireInput}
          allowBackdropClose={pending.options.allowBackdropClose}
          allowEscapeClose={pending.options.allowEscapeClose}
          onClose={handleClose}
          onConfirm={handleConfirm}
        />
      ) : null}
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext)
  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider')
  }
  return context
}
