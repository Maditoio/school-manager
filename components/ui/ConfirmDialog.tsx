'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import {
  AlertTriangle,
  CheckCircle,
  Info,
  ShieldAlert,
  Trash2,
  UserRound,
} from 'lucide-react'

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info' | 'success' | 'system'

export interface ConfirmDialogEntity {
  name: string
  subtitle?: string
  avatarSrc?: string
}

export interface ConfirmDialogProps {
  isOpen: boolean
  isClosing?: boolean
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
  onClose: () => void
  onConfirm: () => void | Promise<void>
}

type VariantConfig = {
  accent: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  confirmStyle: React.CSSProperties
  confirmHoverShadow?: string
  confirmTextColor?: string
}

const variantMap: Record<ConfirmDialogVariant, VariantConfig> = {
  danger: {
    accent: '#ef4444',
    icon: Trash2,
    confirmStyle: { backgroundColor: '#ef4444', color: '#fff' },
    confirmHoverShadow: '0 4px 20px rgba(239,68,68,0.4)',
  },
  warning: {
    accent: '#fbbf24',
    icon: AlertTriangle,
    confirmStyle: { backgroundColor: '#fbbf24', color: '#0f172a' },
  },
  info: {
    accent: '#6366f1',
    icon: Info,
    confirmStyle: { backgroundColor: '#6366f1', color: '#fff' },
  },
  success: {
    accent: '#34d399',
    icon: CheckCircle,
    confirmStyle: { backgroundColor: '#34d399', color: '#fff' },
  },
  system: {
    accent: '#a78bfa',
    icon: ShieldAlert,
    confirmStyle: { backgroundColor: '#a78bfa', color: '#fff' },
  },
}

export default function ConfirmDialog({
  isOpen,
  isClosing = false,
  title,
  description,
  variant = 'danger',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loadingLabel = 'Processing...',
  entity,
  requireInput,
  allowBackdropClose,
  allowEscapeClose,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const panelRef = useRef<HTMLDivElement | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null)
  const lastFocusedElementRef = useRef<HTMLElement | null>(null)

  const config = variantMap[variant]
  const Icon = config.icon

  const backdropClosable = allowBackdropClose ?? !(variant === 'danger' || variant === 'system')
  const escapeClosable = allowEscapeClose ?? !(variant === 'danger' || variant === 'system')

  const inputRequired = typeof requireInput === 'string' && requireInput.length > 0
  const inputMatches = !inputRequired || typedValue === requireInput

  useEffect(() => {
    if (!isOpen) return

    lastFocusedElementRef.current = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => {
      confirmButtonRef.current?.focus()
    }, 120)

    return () => {
      window.clearTimeout(timer)
      lastFocusedElementRef.current?.focus?.()
    }
  }, [isOpen])

  const canConfirm = inputMatches && !isSubmitting

  const dialogDescriptionId = useMemo(
    () => `confirm-dialog-description-${title.replace(/\s+/g, '-').toLowerCase()}`,
    [title]
  )

  const dialogTitleId = useMemo(
    () => `confirm-dialog-title-${title.replace(/\s+/g, '-').toLowerCase()}`,
    [title]
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (!escapeClosable) {
        event.preventDefault()
        return
      }
      if (!isSubmitting) onClose()
      return
    }

    if (event.key !== 'Tab') return

    const root = panelRef.current
    if (!root) return

    const focusable = root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
      return
    }

    if (document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const onBackdropClick = () => {
    if (isSubmitting) return
    if (backdropClosable) {
      onClose()
    }
  }

  const onConfirmClick = async () => {
    if (!canConfirm) return

    try {
      setErrorMessage('')
      setIsSubmitting(true)
      await onConfirm()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      setErrorMessage(message)
      setIsSubmitting(false)
    }
  }

  if (typeof document === 'undefined' || (!isOpen && !isClosing)) return null

  const panelEntering = isOpen && !isClosing

  return createPortal(
    <div className="fixed inset-0 z-120" aria-hidden={false}>
      <div
        className="absolute inset-0"
        onClick={onBackdropClick}
        style={{
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(10px)',
          opacity: panelEntering ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          aria-describedby={dialogDescriptionId}
          onKeyDown={handleKeyDown}
          className="relative w-[90vw] max-w-110 overflow-hidden"
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
          {variant === 'system' ? (
            <div
              className="absolute left-0 right-0 top-0 px-4 py-2 text-center text-xs font-semibold"
              style={{
                background: 'rgba(167,139,250,0.08)',
                color: '#c4b5fd',
              }}
            >
              ⚠ This is a system-level action
            </div>
          ) : null}

          <div className={variant === 'system' ? 'pt-6' : ''}>
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

            <h2
              id={dialogTitleId}
              className="mt-5 text-center text-[18px] font-bold"
              style={{ color: '#e2e8f0' }}
            >
              {title}
            </h2>

            <p
              id={dialogDescriptionId}
              className="mx-auto mt-2 max-w-85 text-center text-[14px]"
              style={{ color: '#64748b', lineHeight: 1.65 }}
            >
              {description}
            </p>

            {entity ? (
              <div
                className="mt-5 flex items-center gap-3 rounded-[10px] px-4 py-3"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {entity.avatarSrc ? (
                  <Image src={entity.avatarSrc} alt={entity.name} width={36} height={36} className="h-9 w-9 rounded-full object-cover" unoptimized />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10">
                    <UserRound className="h-4 w-4 text-slate-300" />
                  </div>
                )}
                <div>
                  <p className="text-[13.5px] font-bold text-slate-200">{entity.name}</p>
                  {entity.subtitle ? <p className="text-xs text-slate-400">{entity.subtitle}</p> : null}
                </div>
              </div>
            ) : null}

            {inputRequired ? (
              <div className="mt-5">
                <p className="mb-2 text-xs italic text-slate-400">Type &quot;{requireInput}&quot; to confirm</p>
                <input
                  type="text"
                  value={typedValue}
                  onChange={(event) => setTypedValue(event.target.value)}
                  className="ui-input"
                  autoComplete="off"
                />
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={onConfirmClick}
                disabled={!canConfirm}
                className="h-11 w-full rounded-xl text-sm font-bold transition-all duration-200"
                style={{
                  ...config.confirmStyle,
                  opacity: canConfirm ? 1 : 0.4,
                  cursor: canConfirm ? 'pointer' : 'not-allowed',
                  boxShadow: canConfirm && config.confirmHoverShadow ? config.confirmHoverShadow : 'none',
                }}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {loadingLabel}
                  </span>
                ) : (
                  confirmLabel
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-11 w-full rounded-xl text-sm font-semibold transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8',
                  opacity: isSubmitting ? 0.4 : 1,
                }}
              >
                {cancelLabel}
              </button>
            </div>

            {errorMessage ? (
              <p className="mt-3 text-sm text-rose-400 transition-opacity duration-200">{errorMessage}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
