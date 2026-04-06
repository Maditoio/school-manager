/**
 * Canonical admin navigation items — import this in all admin pages
 * so the sidebar is consistent regardless of which page is active.
 *
 * Items support a `group` property: Navigation.tsx will render grouped
 * items as collapsible sections.
 */

export interface NavItem {
  label: string
  href: string
  icon?: string
  /** If set, this item belongs to a collapsible group with this name */
  group?: string
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard' },

  // ── Academic roster (collapsible group) ──────────────────────────
  { label: 'Students',  href: '/admin/students',  group: 'Academic' },
  { label: 'Teachers',  href: '/admin/teachers',  group: 'Academic' },
  { label: 'Classes',   href: '/admin/classes',   group: 'Academic' },
  { label: 'Subjects',  href: '/admin/subjects',  group: 'Academic' },

  // ── Academic activity ─────────────────────────────────────────────
  { label: 'Attendance',  href: '/admin/attendance' },
  { label: 'Results',     href: '/admin/results' },

  // ── Finance ───────────────────────────────────────────────────────
  { label: 'Fees',          href: '/admin/fees' },
  { label: 'Expenses',      href: '/admin/expenses' },
  { label: 'Fund Requests', href: '/admin/fund-requests' },
  { label: 'Meeting Agenda',href: '/admin/meeting-agenda' },

  // ── Admin ─────────────────────────────────────────────────────────
  { label: 'Users',             href: '/admin/users' },
  { label: 'Deletion Requests', href: '/admin/deletion-requests' },
  { label: 'Announcements',     href: '/admin/announcements' },
  { label: 'Messages',          href: '/admin/messages' },
  { label: 'Interaction Logs',  href: '/admin/interaction-logs' },
  { label: 'Settings',          href: '/admin/settings' },
]

/** Finance-role navigation (FINANCE, FINANCE_MANAGER) */
export const FINANCE_NAV_ITEMS: NavItem[] = [
  { label: 'Fees',           href: '/finance/fees' },
  { label: 'Expenses',       href: '/finance/expenses' },
  { label: 'Fund Requests',  href: '/finance/fund-requests' },
  { label: 'Meeting Agenda', href: '/admin/meeting-agenda' },
]

/** Teacher navigation */
export const TEACHER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    href: '/teacher/dashboard',    icon: '📊' },
  { label: 'My Classes',   href: '/teacher/classes',      icon: '🏫' },
  { label: 'Students',     href: '/teacher/students',     icon: '👨‍🎓' },
  { label: 'Assessments',  href: '/teacher/assessments',  icon: '📋' },
  { label: 'Attendance',   href: '/teacher/attendance',   icon: '📅' },
  { label: 'Off Days',     href: '/teacher/off-days',     icon: '🛌' },
  { label: 'Results',      href: '/teacher/results',      icon: '📝' },
  { label: 'Announcements',href: '/teacher/announcements',icon: '📢' },
  { label: 'Messages',     href: '/teacher/messages',     icon: '💬' },
  { label: 'Fund Requests',href: '/teacher/fund-requests',icon: '📦' },
]
