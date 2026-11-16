'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

export type ActionMenuItem = {
  id: string
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
  separatorBefore?: boolean
}

type ActionMenuProps = {
  label?: string
  items: ActionMenuItem[]
  align?: 'left' | 'right'
}

export function ActionMenu({ label = "Plus d'actions", items, align = 'right' }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; ready: boolean }>({
    top: 0,
    left: 0,
    ready: false,
  })
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setCoords({ top: 0, left: 0, ready: false })
      return
    }

    const updatePosition = () => {
      const button = buttonRef.current
      const menu = menuRef.current
      if (!button || !menu) return

      const rect = button.getBoundingClientRect()
      const menuWidth = menu.offsetWidth
      const menuHeight = menu.offsetHeight
      const gap = 4
      const padding = 8

      let left = align === 'right' ? rect.right - menuWidth : rect.left
      left = Math.min(Math.max(padding, left), window.innerWidth - menuWidth - padding)

      let top = rect.bottom + gap
      if (top + menuHeight > window.innerHeight - padding && rect.top - gap - menuHeight >= padding) {
        top = rect.top - gap - menuHeight
      }

      setCoords({ top, left, ready: true })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, align, items.length])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-(--border-subtle) bg-(--surface-soft) ui-text-secondary transition-colors duration-150 hover:ui-text-primary"
        onClick={() => setOpen((prev) => !prev)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && mounted
        ? createPortal(
            <div
              id={menuId}
              ref={menuRef}
              role="menu"
              style={{
                top: coords.top,
                left: coords.left,
                visibility: coords.ready ? 'visible' : 'hidden',
              }}
              className="fixed z-[80] min-w-48 rounded-[10px] border border-(--border-subtle) bg-(--surface) p-1.5 shadow-(--shadow-soft)"
            >
              {items.map((item) => (
                <div key={item.id}>
                  {item.separatorBefore ? (
                    <div className="my-1 border-t border-(--border-subtle)" role="separator" />
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    className={`flex w-full items-center rounded-[6px] px-3 py-2 text-left text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                      item.tone === 'danger'
                        ? 'text-[var(--danger)] hover:bg-(--surface-soft)'
                        : 'ui-text-secondary hover:bg-(--surface-soft) hover:ui-text-primary'
                    }`}
                    onClick={() => {
                      setOpen(false)
                      item.onClick()
                    }}
                  >
                    {item.label}
                  </button>
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
