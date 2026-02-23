'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import {
  Bell,
  BookOpen,
  Calendar,
  ClipboardList,
  GraduationCap,
  Home,
  LineChart,
  MessageSquare,
  School,
  Search,
  Shield,
  UserRound,
  Users,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
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
}

const iconByLabel: Record<string, React.ComponentType<{ className?: string }>> = {
  Dashboard: Home,
  Students: GraduationCap,
  Teachers: Users,
  Classes: School,
  Subjects: BookOpen,
  Attendance: Calendar,
  Results: ClipboardList,
  Announcements: Bell,
  Messages: MessageSquare,
  Fees: LineChart,
  Analytics: LineChart,
  'My Children': Users,
  Assessments: ClipboardList,
  'Interaction Logs': Search,
  Schools: School,
  Users: UserRound,
}

export function Sidebar({ items, user, onLogout }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full bg-(--surface) border-r border-(--border-subtle) shadow-(--shadow-soft)">
      {/* Logo */}
      <div className="p-6 border-b border-(--border-subtle)">
        <h1 className="text-xl font-bold ui-text-primary">School Connect</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {items.map((item) => {
          const isActive = pathname === item.href
          const Icon = iconByLabel[item.label] || Shield
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'bg-(--surface-soft) ui-text-primary font-medium shadow-[0_3px_14px_rgba(15,23,42,0.08)]'
                  : 'ui-text-secondary hover:bg-(--surface-soft) hover:-translate-y-0.5'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-(--border-subtle)">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-(--surface-soft) flex items-center justify-center">
            <span className="ui-text-secondary font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium ui-text-primary truncate">{user.name}</p>
            <p className="text-xs ui-text-secondary truncate">{user.role}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full ui-button ui-button-secondary"
        >
          Logout
        </button>
      </div>
    </div>
  )
}

interface MobileNavProps {
  items: NavItem[]
}

export function MobileNav({ items }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-(--surface) border-t border-(--border-subtle) shadow-[0_-4px_20px_rgba(15,23,42,0.1)] md:hidden">
      <div className="flex justify-around items-center h-16">
        {items.slice(0, 5).map((item) => {
          const isActive = pathname === item.href
          const Icon = iconByLabel[item.label] || Shield
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full ${
                isActive ? 'ui-text-primary' : 'ui-text-secondary'
              }`}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-xs">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
