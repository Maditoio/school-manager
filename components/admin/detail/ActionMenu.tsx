'use client'

import { useEffect, useId, useRef, useState } from 'react'
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
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
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

      {open ? (
        <div
          id={menuId}
          role="menu"
          className={`absolute top-9 z-50 min-w-48 rounded-[10px] border border-(--border-subtle) bg-(--surface) p-1.5 shadow-(--shadow-soft) ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
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
        </div>
      ) : null}
    </div>
  )
}
