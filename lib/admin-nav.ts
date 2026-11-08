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

  // ── Academic (people → structure → daily ops → reporting) ─────────
  { label: 'Students',          href: '/admin/students',          group: 'Academic' },
  { label: 'Teachers',          href: '/admin/teachers',          group: 'Academic' },
  { label: 'Classes',           href: '/admin/classes',           group: 'Academic' },
  { label: 'Subjects',          href: '/admin/subjects',          group: 'Academic' },
  { label: 'Timetable',         href: '/admin/timetable',         group: 'Academic' },
  { label: 'Attendance',        href: '/admin/attendance',        group: 'Academic' },
  { label: 'Results',           href: '/admin/results',           group: 'Academic' },
  { label: 'Reports',           href: '/admin/reports',           group: 'Academic' },
  { label: 'Report Templates',  href: '/admin/report-templates',  group: 'Academic' },

  // ── Finance (daily money first; invoice last) ─────────────────────
  { label: 'Fees',           href: '/admin/fees' },
  { label: 'Expenses',       href: '/admin/expenses' },
  { label: 'Fund Requests',  href: '/admin/fund-requests' },
  { label: 'School invoice', href: '/admin/billing' },

  // ── Communications ────────────────────────────────────────────────
  { label: 'Announcements', href: '/admin/announcements' },
  { label: 'Messages',      href: '/admin/messages' },

  // ── System (rare tools; Settings always last) ─────────────────────
  { label: 'Users',             href: '/admin/users' },
  { label: 'Deletion Requests', href: '/admin/deletion-requests' },
  { label: 'Interaction Logs',  href: '/admin/interaction-logs' },
  { label: 'Settings',          href: '/admin/settings' },
]

/** Deputy Admin navigation — same as ADMIN but without Attendance and Settings */
export const DEPUTY_ADMIN_NAV_ITEMS: NavItem[] = ADMIN_NAV_ITEMS.filter(
  item => item.href !== '/admin/attendance' && item.href !== '/admin/settings'
)

/** Finance-role navigation (FINANCE, FINANCE_MANAGER) */
export const FINANCE_NAV_ITEMS: NavItem[] = [
  { label: 'Fees',           href: '/finance/fees' },
  { label: 'Expenses',       href: '/finance/expenses' },
  { label: 'Fund Requests',  href: '/finance/fund-requests' },
  { label: 'School invoice', href: '/finance/billing' },
]

/** Finance Manager navigation (superset of FINANCE_NAV_ITEMS with salary management) */
export const FINANCE_MANAGER_NAV_ITEMS: NavItem[] = [
  { label: 'Fees',             href: '/finance/fees' },
  { label: 'Expenses',         href: '/finance/expenses' },
  { label: 'Fund Requests',    href: '/finance/fund-requests' },
  { label: 'Teacher Salaries', href: '/finance/salaries' },
  { label: 'School invoice',   href: '/finance/billing' },
]

/** Teacher navigation */
export const TEACHER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    href: '/teacher/dashboard',    icon: '📊' },
  { label: 'My Classes',   href: '/teacher/classes',      icon: '🏫' },
  { label: 'Students',     href: '/teacher/students',     icon: '👨‍🎓' },
  { label: 'Assessments',  href: '/teacher/assessments',  icon: '📋' },
  { label: 'Attendance',   href: '/teacher/attendance',   icon: '📅' },
  { label: 'Timetable',    href: '/teacher/timetable',    icon: '🗓️' },
  { label: 'My Salary',    href: '/teacher/salary',       icon: '💵' },
  { label: 'Off Days',     href: '/teacher/off-days',     icon: '🛌' },
  { label: 'Results',      href: '/teacher/results',      icon: '📝' },
  { label: 'Announcements',href: '/teacher/announcements',icon: '📢' },
  { label: 'Messages',     href: '/teacher/messages',     icon: '💬' },
  { label: 'Meeting Agenda', href: '/teacher/meeting-agenda', icon: '📋' },
  { label: 'My Courses',   href: '/teacher/courses',      icon: '🎬' },
  { label: 'Earnings',     href: '/teacher/earnings',     icon: '💰' },
]

/** Student navigation */
export const STUDENT_NAV_ITEMS: NavItem[] = [
  { label: 'My Profile',      href: '/student/dashboard',      icon: '👤' },
  { label: 'School Fees',     href: '/student/fees',           icon: '💰' },
  { label: 'Communications',  href: '/student/communications', icon: '📢' },
  { label: 'Timetable',        href: '/student/timetable',      icon: '🗓️' },
  { label: 'Student Hub',     href: '/student/hub',            icon: '🚀' },
  { label: 'Library',         href: '/student/library',        icon: '📚' },
]

/** Parent navigation — English source labels; DashboardLayout translates via locale */
export const PARENT_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/parent/dashboard' },
  { label: 'Results', href: '/parent/results' },
  { label: 'Attendance', href: '/parent/attendance' },
  { label: 'Upcoming', href: '/parent/upcoming' },
  { label: 'Announcements', href: '/parent/announcements' },
  { label: 'Messages', href: '/parent/messages' },
]
