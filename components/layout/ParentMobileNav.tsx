'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useId, useState, type ComponentType } from 'react'
import {
  Calendar,
  ClipboardList,
  Clock,
  Home,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  X,
} from 'lucide-react'
import { translateText } from '@/lib/client-i18n'
import { useLocale } from '@/lib/locale-context'
import type { NavItem } from '@/components/layout/Navigation'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'

interface ParentMobileNavProps {
  items: NavItem[]
  onLogout?: () => void
  language?: string
  onLanguageChange?: (code: string) => void
  fontScale?: string
  onFontScaleCycle?: () => void
}

const iconBySegment: Record<string, ComponentType<{ className?: string }>> = {
  dashboard: Home,
  results: ClipboardList,
  attendance: Calendar,
  upcoming: Clock,
  announcements: Megaphone,
  messages: MessageSquare,
}

function getIconFromHref(href: string) {
  const segment = href.split('/').filter(Boolean).at(-1) || ''
  return iconBySegment[segment] || Home
}

function resolveActiveLabel(items: NavItem[], pathname: string) {
  const exact = items.find((item) => item.href === pathname)
  if (exact) return exact.label

  const prefixMatch = items
    .filter((item) => pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return prefixMatch?.label ?? ''
}

export function ParentMobileNav({
  items,
  onLogout,
  language,
  onLanguageChange,
  fontScale = 'normal',
  onFontScaleCycle,
}: ParentMobileNavProps) {
  const pathname = usePathname()
  const { locale } = useLocale()
  const drawerId = useId()
  const [open, setOpen] = useState(false)

  const currentTitle = resolveActiveLabel(items, pathname)
  const closeDrawer = useCallback(() => setOpen(false), [])
  const toggleDrawer = useCallback(() => setOpen((prev) => !prev), [])
  const activeLanguage = String(language || locale || 'en').toLowerCase()
  const scale = String(fontScale || 'normal').toLowerCase()
  const fontScaleLabel =
    scale === 'x-large'
      ? translateText('Extra large', locale)
      : scale === 'large'
        ? translateText('Large', locale)
        : translateText('Default', locale)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-(--border-subtle) bg-(--surface) print:hidden">
        <div className="flex h-14 items-center gap-3 px-3">
          <button
            type="button"
            onClick={toggleDrawer}
            aria-expanded={open}
            aria-controls={drawerId}
            aria-label={open ? translateText('Close menu', locale) : translateText('Open menu', locale)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-(--border-subtle) bg-(--surface) ui-text-primary transition-all duration-[150ms] ease-[ease] hover:bg-[#f6f9fc] active:scale-[0.97]"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <p className="min-w-0 truncate text-[0.875rem] font-semibold ui-text-primary">{currentTitle}</p>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[60] bg-(--overlay) transition-opacity duration-[150ms] ease-[ease] print:hidden ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeDrawer}
        aria-hidden={!open}
      />

      <aside
        id={drawerId}
        role="dialog"
        aria-modal="true"
        aria-label={translateText('Navigation', locale)}
        className="fixed left-0 top-0 z-[70] flex h-full w-[220px] flex-col border-r border-(--border-subtle) bg-(--surface) transition-transform duration-[150ms] ease-[ease] print:hidden"
        style={{ transform: open ? 'translateX(0)' : 'translateX(-100%)' }}
        aria-hidden={!open}
      >
        <div className="flex h-14 items-center justify-between border-b border-(--border-subtle) px-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
            {translateText('Menu', locale)}
          </p>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label={translateText('Close menu', locale)}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] ui-text-secondary transition-colors duration-[150ms] ease-[ease] hover:bg-[#f6f9fc] hover:ui-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label={translateText('Parent navigation', locale)}>
          <ul className="space-y-0.5">
            {items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              const Icon = getIconFromHref(item.href)

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeDrawer}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex h-10 items-center gap-2.5 rounded-[6px] px-3 text-[0.875rem] font-medium transition-colors duration-[150ms] ease-[ease] ${
                      isActive
                        ? 'border-l-[3px] border-l-[#635bff] bg-[#f0effe] pl-[9px] text-[#635bff]'
                        : 'border-l-[3px] border-l-transparent ui-text-primary hover:bg-[#f6f9fc]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-(--border-subtle) p-2 space-y-2">
          {onLanguageChange ? (
            <LanguageSwitcher
              className="px-1"
              value={activeLanguage}
              locale={locale}
              onChange={(code) => onLanguageChange(code)}
            />
          ) : null}

          {onFontScaleCycle ? (
            <button
              type="button"
              onClick={onFontScaleCycle}
              aria-label={`${translateText('Text size', locale)}: ${fontScaleLabel}`}
              className="flex h-10 w-full items-center justify-between rounded-[6px] px-3 text-[0.875rem] font-medium ui-text-primary transition-colors duration-[150ms] ease-[ease] hover:bg-[#f6f9fc]"
            >
              <span>{translateText('Text size', locale)}</span>
              <span className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-[#635bff]">
                {fontScaleLabel}
              </span>
            </button>
          ) : null}

          {onLogout ? (
            <button
              type="button"
              onClick={() => {
                closeDrawer()
                onLogout()
              }}
              className="flex h-10 w-full items-center gap-2.5 rounded-[6px] px-3 text-[0.875rem] font-medium text-[#c0392b] transition-colors duration-[150ms] ease-[ease] hover:bg-[#fff0ee]"
              aria-label={translateText('Logout', locale)}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>{translateText('Logout', locale)}</span>
            </button>
          ) : null}
        </div>
      </aside>
    </>
  )
}
