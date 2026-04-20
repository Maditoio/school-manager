'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import {
  ChevronRight,
  Bell,
  BookOpen,
  Calendar,
  CalendarDays,
  ClipboardList,
  FileText,
  Layers,
  LogOut,
  Settings,
  Shield,
  GraduationCap,
  Home,
  LineChart,
  MessageSquare,
  School,
  Search,
  Trash2,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  /** Name of the collapsible group this item belongs to */
  group?: string
  icon?: React.ReactNode
}

interface SidebarProps {
  items: NavItem[]
  user: {
    name: string
    role: string
    email: string
  }
  onLogout: () => void
  appName?: string
  onDesktopWidthChange?: (width: number) => void
}

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const SIDEBAR_WIDTH_OPEN = 240
const SIDEBAR_WIDTH_COLLAPSED = 64
const SIDEBAR_TRANSITION = 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
const LS_SIDEBAR_KEY = 'sc_sidebar_open'
const LS_GROUPS_KEY = 'sc_sidebar_groups'

const iconBySegment: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: Home,
  students: GraduationCap,
  teachers: Users,
  classes: School,
  subjects: BookOpen,
  attendance: Calendar,
  results: ClipboardList,
  reports: FileText,
  announcements: Bell,
  messages: MessageSquare,
  fees: LineChart,
  expenses: Wallet,
  terms: CalendarDays,
  analytics: LineChart,
  assessments: ClipboardList,
  schools: School,
  users: UserRound,
  'interaction-logs': Search,
  'fund-requests': FileText,
  'meeting-agenda': FileText,
  'deletion-requests': Trash2,
  settings: Settings,
}

const groupIconByName: Record<string, React.ComponentType<{ className?: string }>> = {
  Academic: Layers,
}

function getIconFromHref(href: string) {
  const segment = href.split('/').filter(Boolean).at(-1) || ''
  return iconBySegment[segment] || Shield
}

/**
 * Build rendering sections from a flat item list.
 * Returns an ordered array of:
 *   { type: 'item', item }
 *   { type: 'group', name, children }
 */
function buildSections(items: NavItem[]) {
  const result: Array<
    | { type: 'item'; item: NavItem; index: number }
    | { type: 'group'; name: string; children: NavItem[] }
  > = []
  const seenGroups = new Set<string>()

  for (const item of items) {
    if (!item.group) {
      result.push({ type: 'item', item, index: result.length })
    } else if (!seenGroups.has(item.group)) {
      seenGroups.add(item.group)
      const children = items.filter((i) => i.group === item.group)
      result.push({ type: 'group', name: item.group, children })
    }
    // else: already accounted for in its group
  }

  return result
}

export function Sidebar({ items, user, onLogout, appName = 'School Connect', onDesktopWidthChange }: SidebarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(true)
  const [isDesktop, setIsDesktop] = useState(false)
  // groups open state: { [groupName]: boolean }
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [hydrated, setHydrated] = useState(false)

  // Restore state from localStorage after hydration
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_SIDEBAR_KEY)
      if (stored !== null) setIsOpen(stored === 'true')
      const storedGroups = localStorage.getItem(LS_GROUPS_KEY)
      if (storedGroups) setOpenGroups(JSON.parse(storedGroups))
    } catch {
      // ignore
    }
    setHydrated(true)
  }, [])

  // Auto-expand group containing the active page
  useEffect(() => {
    if (!hydrated) return
    const activeItem = items.find((i) => i.href === pathname)
    if (activeItem?.group) {
      setOpenGroups((prev) => {
        if (prev[activeItem.group!]) return prev
        const next = { ...prev, [activeItem.group!]: true }
        try { localStorage.setItem(LS_GROUPS_KEY, JSON.stringify(next)) } catch { /* ok */ }
        return next
      })
    }
  }, [pathname, items, hydrated])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const applyBreakpoint = (matches: boolean) => {
      setIsDesktop(matches)
      if (!matches) setIsOpen(false)
    }
    applyBreakpoint(mediaQuery.matches)
    const listener = (event: MediaQueryListEvent) => applyBreakpoint(event.matches)
    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setIsOpen((prev) => {
      try { localStorage.setItem(LS_SIDEBAR_KEY, String(!prev)) } catch { /* ok */ }
      return !prev
    })
  }, [])

  const toggleGroup = useCallback((name: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [name]: !prev[name] }
      try { localStorage.setItem(LS_GROUPS_KEY, JSON.stringify(next)) } catch { /* ok */ }
      return next
    })
  }, [])

  const width = isOpen ? SIDEBAR_WIDTH_OPEN : SIDEBAR_WIDTH_COLLAPSED

  useEffect(() => {
    if (isDesktop) onDesktopWidthChange?.(width)
    else onDesktopWidthChange?.(SIDEBAR_WIDTH_COLLAPSED)
  }, [isDesktop, onDesktopWidthChange, width])

  const initials = useMemo(() => {
    const [first = '', second = ''] = user.name.split(' ')
    return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase() || 'A'
  }, [user.name])

  const avatarSrc = useMemo(() => {
    const background = encodeURIComponent('#1F2937')
    const foreground = encodeURIComponent('#E2E8F0')
    const text = encodeURIComponent(initials)
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><rect width='100%' height='100%' rx='36' fill='${background}'/><text x='50%' y='52%' font-family='sans-serif' font-size='28' fill='${foreground}' text-anchor='middle' dominant-baseline='middle'>${text}</text></svg>`
    return `data:image/svg+xml;utf8,${svg}`
  }, [initials])

  const sections = useMemo(() => buildSections(items), [items])

  const sidebarLabelBase =
    'pointer-events-none whitespace-nowrap text-[13px] font-medium transition-all duration-200 ease-out'

  // Shared nav link renderer
  const renderNavLink = (item: NavItem, index: number, indent = false) => {
    const isActive = pathname === item.href
    const Icon = getIconFromHref(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`group relative flex h-10 items-center overflow-hidden rounded-xl transition-all duration-200 ${
          isOpen ? (indent ? 'px-3 pl-8' : 'px-3') : 'justify-center px-0'
        } ${
          isActive
            ? 'bg-linear-to-r from-indigo-500/90 to-blue-500/80 text-white shadow-[0_8px_24px_rgba(79,70,229,0.35)]'
            : 'text-slate-300 hover:bg-white/8 hover:backdrop-blur-sm hover:shadow-[0_8px_24px_rgba(59,130,246,0.12)]'
        }`}
      >
        <span
          className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-indigo-300 transition-all duration-200 ${
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        />
        <Icon className="h-4 w-4 shrink-0" />
        <span
          className={`${sidebarLabelBase} overflow-hidden`}
          style={{
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? 'translateX(0)' : 'translateX(-8px)',
            width: isOpen ? 132 : 0,
            marginLeft: isOpen ? 10 : 0,
            transitionDelay: isOpen ? `${(index + 1) * 30}ms` : '0ms',
          }}
        >
          {item.label}
        </span>
      </Link>
    )
  }

  return (
    <aside
      className={`${plusJakartaSans.className} fixed left-0 top-0 z-50 h-screen border-r border-white/10 bg-[#0F1117] text-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.45)]`}
      style={{ width, transition: SIDEBAR_TRANSITION }}
    >
      <div className="flex h-full flex-col px-3 py-4">
        {/* Logo / app name */}
        <div className={`mb-5 flex h-12 items-center ${isOpen ? 'justify-between px-2' : 'justify-center'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
              <Shield className="h-5 w-5" />
            </div>
            <span
              className={`${sidebarLabelBase} overflow-hidden`}
              style={{
                opacity: isOpen ? 1 : 0,
                transform: isOpen ? 'translateX(0)' : 'translateX(-8px)',
                width: isOpen ? 132 : 0,
                transitionDelay: isOpen ? '80ms' : '0ms',
              }}
            >
              {appName}
            </span>
          </div>

          <button
            type="button"
            aria-label="Toggle sidebar"
            onClick={handleToggleSidebar}
            className="absolute -right-3 top-6 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-[#151925] text-slate-300 shadow-lg transition hover:border-indigo-400/50 hover:text-indigo-300"
          >
            <ChevronRight
              className="h-3.5 w-3.5 transition-transform duration-300"
              style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {sections.map((section, si) => {
            if (section.type === 'item') {
              return renderNavLink(section.item, si)
            }

            // ── Collapsible group ──────────────────────────────────
            const { name, children } = section
            const GroupIcon = groupIconByName[name] ?? Layers
            const isExpanded = openGroups[name] ?? false
            const hasActiveChild = children.some((c) => pathname === c.href)

            return (
              <div key={name}>
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => isOpen && toggleGroup(name)}
                  title={isOpen ? undefined : name}
                  className={`group relative flex h-10 w-full items-center overflow-hidden rounded-xl transition-all duration-200 ${
                    isOpen ? 'px-3' : 'justify-center px-0'
                  } ${
                    hasActiveChild && !isExpanded
                      ? 'bg-white/8 text-indigo-300'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  <span
                    className={`${sidebarLabelBase} overflow-hidden flex-1 text-left`}
                    style={{
                      opacity: isOpen ? 1 : 0,
                      transform: isOpen ? 'translateX(0)' : 'translateX(-8px)',
                      width: isOpen ? 100 : 0,
                      marginLeft: isOpen ? 10 : 0,
                      transitionDelay: isOpen ? `${(si + 1) * 30}ms` : '0ms',
                    }}
                  >
                    {name}
                  </span>
                  {isOpen && (
                    <ChevronRight
                      className="h-3 w-3 shrink-0 transition-transform duration-200 text-slate-500"
                      style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    />
                  )}
                </button>

                {/* Group children — shown when expanded OR when sidebar is collapsed (icon-only) */}
                {(isExpanded || !isOpen) && (
                  <div className={`${isOpen ? 'mt-0.5 space-y-0.5' : 'space-y-0.5'}`}>
                    {children.map((child, ci) => renderNavLink(child, ci, isOpen))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* User footer */}
        <div className={`mt-4 flex items-center ${isOpen ? 'gap-3 px-1' : 'flex-col gap-3'}`}>
          <Image
            src={avatarSrc}
            alt={user.name}
            width={36}
            height={36}
            className="h-9 w-9 rounded-full ring-2 ring-white/15"
            unoptimized
          />
          <div
            className={`${sidebarLabelBase} overflow-hidden`}
            style={{
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? 'translateX(0)' : 'translateX(-8px)',
              width: isOpen ? 132 : 0,
              transitionDelay: isOpen ? '100ms' : '0ms',
            }}
          >
            <p className="max-w-28 truncate text-[13px] font-semibold text-slate-100">{user.name}</p>
            <p className="max-w-28 truncate text-[11px] text-slate-400">{user.role}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Logout"
            className={`${isOpen ? 'ml-auto' : ''} flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:border-indigo-400/50 hover:bg-indigo-500/15 hover:text-indigo-200`}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

export function MobileNav() {
  return null
}

interface BottomSidebarNavProps {
  items: NavItem[]
  onLogout?: () => void
}

export function BottomSidebarNav({ items, onLogout }: BottomSidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-(--border-subtle) bg-(--surface) px-2 py-2 shadow-[0_-6px_18px_rgba(0,0,0,0.12)] md:px-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-1 overflow-x-auto">
        {items.map((item) => {
          const isActive = pathname === item.href
          const Icon = getIconFromHref(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition ${
                isActive
                  ? 'bg-(--surface-soft) ui-text-primary'
                  : 'ui-text-secondary hover:bg-(--surface-soft) hover:ui-text-primary'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition text-rose-400 hover:bg-(--surface-soft)"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="truncate">Logout</span>
          </button>
        )}
      </div>
    </nav>
  )
}
