'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'

export type AlertDialogVariant = 'error' | 'warning' | 'info' | 'success'

export interface AlertDialogProps {
  isOpen: boolean
  isClosing?: boolean
  title: string
  message: string
  variant?: AlertDialogVariant
  okLabel?: string
  onClose: () => void
}

type VariantConfig = {
  accent: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  buttonStyle: React.CSSProperties
}

const variantMap: Record<AlertDialogVariant, VariantConfig> = {
  error: {
    accent: '#ef4444',
    icon: XCircle,
    buttonStyle: { backgroundColor: '#ef4444', color: '#fff' },
  },
  warning: {
    accent: '#f59e0b',
    icon: AlertTriangle,
    buttonStyle: { backgroundColor: '#f59e0b', color: '#0f172a' },
  },
  info: {
    accent: '#6366f1',
    icon: Info,
    buttonStyle: { backgroundColor: '#6366f1', color: '#fff' },
  },
  success: {
    accent: '#34d399',
    icon: CheckCircle,
    buttonStyle: { backgroundColor: '#34d399', color: '#fff' },
  },
}

export default function AlertDialog({
  isOpen,
  isClosing = false,
  title,
  message,
  variant = 'error',
  okLabel = 'OK',
  onClose,
}: AlertDialogProps) {
  const okButtonRef = useRef<HTMLButtonElement | null>(null)
  const lastFocusedElementRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const config = variantMap[variant]
  const Icon = config.icon

  useEffect(() => {
    if (!isOpen) return

    lastFocusedElementRef.current = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => {
      okButtonRef.current?.focus()
    }, 120)

    return () => {
      window.clearTimeout(timer)
      lastFocusedElementRef.current?.focus?.()
    }
  }, [isOpen])

  const dialogTitleId = useMemo(
    () => `alert-dialog-title-${title.replace(/\s+/g, '-').toLowerCase()}`,
    [title],
  )

  const dialogDescriptionId = useMemo(
    () => `alert-dialog-desc-${title.replace(/\s+/g, '-').toLowerCase()}`,
    [title],
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      onClose()
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      okButtonRef.current?.focus()
    }
  }

  if (typeof document === 'undefined' || (!isOpen && !isClosing)) return null

  const panelEntering = isOpen && !isClosing

  return createPortal(
    <div className="fixed inset-0 z-130" aria-hidden={false}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(10px)',
          opacity: panelEntering ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />

      {/* Panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          aria-describedby={dialogDescriptionId}
          onKeyDown={handleKeyDown}
          className="relative w-[90vw] max-w-105 overflow-hidden"
          style={{
            background: '#111420',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
            padding: 32,
            opacity: panelEntering ? 1 : 0,
            transform: panelEntering ? 'scale(1)' : 'scale(0.92)',
            transition: panelEntering
              ? 'transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 260ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              : 'transform 180ms ease, opacity 180ms ease',
          }}
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                background: `${config.accent}1A`,
                border: `1px solid ${config.accent}33`,
                transform: panelEntering ? 'scale(1)' : 'scale(0.5)',
                opacity: panelEntering ? 1 : 0,
                transition: 'transform 260ms cubic-bezier(0.34,1.56,0.64,1) 60ms, opacity 200ms ease 60ms',
              }}
            >
              <Icon className="h-7 w-7" style={{ color: config.accent }} />
            </div>
          </div>

          {/* Title */}
          <h2
            id={dialogTitleId}
            className="mt-5 text-center text-[18px] font-bold"
            style={{ color: '#e2e8f0' }}
          >
            {title}
          </h2>

          {/* Message */}
          <p
            id={dialogDescriptionId}
            className="mx-auto mt-2 max-w-85 text-center text-[14px]"
            style={{ color: '#64748b', lineHeight: 1.65 }}
          >
            {message}
          </p>

          {/* OK button */}
          <div className="mt-6">
            <button
              ref={okButtonRef}
              type="button"
              onClick={onClose}
              className="h-11 w-full rounded-xl text-sm font-bold transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              style={config.buttonStyle}
            >
              {okLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
