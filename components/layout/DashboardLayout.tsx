'use client'

import { BottomSidebarNav, Sidebar } from '@/components/layout/Navigation'
import Toolbar from '@/components/layout/Toolbar'
import { signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/components/ui/Toast'
import { type ClientLocale, translateNode, translateText } from '@/lib/client-i18n'
import { useLocale } from '@/lib/locale-context'

interface LayoutProps {
  children: React.ReactNode
  user: {
    name: string
    role: string
    email: string
  }
  navItems: Array<{
    label: string
    href: string
    icon?: React.ReactNode
    group?: string
  }>
}

const LICENSE_RESTRICTED_NAV_PATHS = [
  '/parent/announcements',
  '/parent/attendance',
  '/parent/assessments',
  '/parent/results',
]

const STUDENT_FEES_ALLOWED_NAV_PATHS = ['/student/fees']

export function DashboardLayout({ children, user, navItems }: LayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, update } = useSession()
  const { showToast } = useToast()
  const { locale, setLocale } = useLocale()
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    try {
      return localStorage.getItem('ui-theme') || 'light'
    } catch {
      return 'light'
    }
  })
  const [desktopSidebarWidth, setDesktopSidebarWidth] = useState(240)
  const [schoolName, setSchoolName] = useState('School Dashboard')
  const [isSchoolSuspended, setIsSchoolSuspended] = useState(false)
  const isSidebarOpen = desktopSidebarWidth > 120
  const isParentView = session?.user?.role === 'PARENT' || user.role.toLowerCase() === 'parent'
  const isAdminDashboardRoute = pathname === '/admin/dashboard'

  useEffect(() => {
    // Only check suspension status for non-super-admins
    if (session?.user?.role !== 'SUPER_ADMIN') {
      const checkSuspensionStatus = async () => {
        try {
          const res = await fetch('/api/schools/suspension-status')
          if (res.ok) {
            const data = await res.json()
            setIsSchoolSuspended(data.suspended)
          }
        } catch (error) {
          console.error('Failed to check school suspension status:', error)
        }
      }

      checkSuspensionStatus()
    }
  }, [session?.user?.role])

  useEffect(() => {
    if (isSchoolSuspended) {
      router.push('/school-suspended')
    }
  }, [isSchoolSuspended, router])

  useEffect(() => {
    const schoolId = session?.user?.schoolId

    if (!schoolId) return

    let active = true

    const loadSchoolName = async () => {
      try {
        const response = await fetch(`/api/schools/${schoolId}`)
        if (!response.ok) return
        const data = await response.json()
        const resolvedName = data?.school?.name
        if (active && typeof resolvedName === 'string' && resolvedName.trim()) {
          setSchoolName(resolvedName)
        }
      } catch (error) {
        console.error('Failed to load school name:', error)
      }
    }

    loadSchoolName()

    return () => {
      active = false
    }
  }, [locale, session?.user?.role, session?.user?.schoolId])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
    const themeColorMap: Record<string, string> = {
      light: '#f5f6f8',
      dark: '#0f1720',
      calm: '#f5f8f5',
    }
    document.querySelectorAll('meta[name="theme-color"]').forEach((metaTheme) => {
      metaTheme.setAttribute('content', themeColorMap[theme] ?? themeColorMap.light)
    })
    try {
      document.cookie = `ui-theme=${encodeURIComponent(theme)}; path=/; max-age=31536000; SameSite=Lax`
    } catch {
      // ignore cookie write errors
    }
  }, [theme])

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/login')
  }

  const handleLanguageChange = async (nextLanguage: string) => {
    const nextLocale = nextLanguage as ClientLocale
    const previousLocale = locale
    setLocale(nextLocale)

    try {
      const res = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLanguage: nextLanguage }),
      })

      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || translateText('Failed to save language preference', previousLocale), 'error')
        setLocale(previousLocale)
        return
      }

      await update({ preferredLanguage: nextLocale })
      showToast(translateText('Language preference saved', nextLocale), 'success')
    } catch (error) {
      console.error('Failed to update language preference:', error)
      showToast(translateText('Failed to save language preference', previousLocale), 'error')
      setLocale(previousLocale)
    }
  }

  const handleThemeChange = (nextTheme: string) => {
    setTheme(nextTheme)
    try {
      localStorage.setItem('ui-theme', nextTheme)
    } catch {
      // ignore storage errors
    }
    try {
      document.cookie = `ui-theme=${encodeURIComponent(nextTheme)}; path=/; max-age=31536000; SameSite=Lax`
    } catch {
      // ignore cookie write errors
    }
    document.documentElement.setAttribute('data-theme', nextTheme)
    document.documentElement.style.colorScheme = nextTheme === 'dark' ? 'dark' : 'light'
    const themeColorMap: Record<string, string> = {
      light: '#f5f6f8',
      dark: '#0f1720',
      calm: '#f5f8f5',
    }
    document.querySelectorAll('meta[name="theme-color"]').forEach((metaTheme) => {
      metaTheme.setAttribute('content', themeColorMap[nextTheme] ?? themeColorMap.light)
    })
  }

  const handleThemeToggle = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    handleThemeChange(nextTheme)
  }

  const translatedNavItems = useMemo(() => {
    const enhancedNavItems = [...navItems]
    const isSchoolAdmin = session?.user?.role === 'SCHOOL_ADMIN' || session?.user?.role === 'DEPUTY_ADMIN' || user.role.toLowerCase() === 'school admin' || user.role.toLowerCase() === 'deputy admin'

    if (isSchoolAdmin && !enhancedNavItems.some((item) => item.href === '/admin/terms')) {
      const insertAfter = enhancedNavItems.findIndex((item) => item.href === '/admin/fees')
      const termsItem = { label: 'Terms', href: '/admin/terms', icon: '🗓️' }

      if (insertAfter >= 0) {
        enhancedNavItems.splice(insertAfter + 1, 0, termsItem)
      } else {
        enhancedNavItems.push(termsItem)
      }
    }

    if (isSchoolAdmin && !enhancedNavItems.some((item) => item.href === '/admin/expenses')) {
      const insertAfter = enhancedNavItems.findIndex((item) => item.href === '/admin/terms')
      const expensesItem = { label: 'Expenses', href: '/admin/expenses', icon: '🧾' }

      if (insertAfter >= 0) {
        enhancedNavItems.splice(insertAfter + 1, 0, expensesItem)
      } else {
        enhancedNavItems.push(expensesItem)
      }
    }

    if (isSchoolAdmin && !enhancedNavItems.some((item) => item.href === '/admin/users')) {
      const insertAfter = enhancedNavItems.findIndex((item) => item.href === '/admin/expenses')
      const usersItem = { label: 'Users', href: '/admin/users', icon: '👥' }

      if (insertAfter >= 0) {
        enhancedNavItems.splice(insertAfter + 1, 0, usersItem)
      } else {
        enhancedNavItems.push(usersItem)
      }
    }

    const isPaymentBlocked = Boolean(session?.user?.paymentAccessBlocked)
    const isBlockedStudent = isPaymentBlocked && session?.user?.role === 'STUDENT'
    const isBlockedParent = isPaymentBlocked && session?.user?.role === 'PARENT'

    let filteredNavItems = enhancedNavItems

    if (isBlockedStudent) {
      filteredNavItems = enhancedNavItems.filter((item) =>
        STUDENT_FEES_ALLOWED_NAV_PATHS.some((path) => item.href.startsWith(path))
      )
    } else if (isBlockedParent) {
      filteredNavItems = enhancedNavItems.filter((item) => !LICENSE_RESTRICTED_NAV_PATHS.some((path) => item.href.startsWith(path)))
    }

    return filteredNavItems.map((item) => ({ ...item, label: translateText(item.label, locale) }))
  }, [navItems, locale, session?.user?.role, session?.user?.paymentAccessBlocked, user.role])

  const translatedUser = useMemo(
    () => ({
      ...user,
      role: translateText(user.role, locale),
    }),
    [user, locale]
  )

  const translatedChildren = useMemo(() => {
    const role = String(session?.user?.role || '')
    const shouldTranslatePageContent =
      locale !== 'en' &&
      (role === 'SCHOOL_ADMIN' ||
        role === 'DEPUTY_ADMIN' ||
        role === 'SUPER_ADMIN' ||
        role === 'FINANCE' ||
        role === 'FINANCE_MANAGER' ||
        role === 'TEACHER' ||
        role === 'STUDENT' ||
        role === 'PARENT')

    if (!shouldTranslatePageContent) {
      return children
    }

    return translateNode(children, locale)
  }, [children, locale, session?.user?.role])

  const displaySchoolName =
    !session?.user?.schoolId && session?.user?.role === 'SUPER_ADMIN'
      ? translateText('Platform Dashboard', locale)
      : schoolName

  return (
    <div
      className="min-h-screen ui-text-primary"
      style={{ background: isAdminDashboardRoute ? '#0b0d14' : 'var(--background)' }}
    >
      {!isParentView ? (
        <div className="print:hidden">
          <Sidebar
            items={translatedNavItems}
            user={translatedUser}
            onLogout={handleLogout}
            onDesktopWidthChange={setDesktopSidebarWidth}
          />
        </div>
      ) : null}

      <div
        className="flex min-h-screen flex-col overflow-hidden print:ml-0"
        style={{
          background: isAdminDashboardRoute ? '#0b0d14' : 'transparent',
          marginLeft: isParentView ? 0 : desktopSidebarWidth,
          transition: 'margin-left 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {!isParentView ? (
          <div className="print:hidden">
          <Toolbar
            sidebarOpen={isSidebarOpen}
            schoolName={displaySchoolName}
            theme={theme}
            onThemeToggle={handleThemeToggle}
            language={locale}
            onLanguageChange={handleLanguageChange}
          />
          </div>
        ) : null}
        <main
          className={`flex-1 overflow-auto p-4 ${isParentView ? 'pt-4 pb-24 md:pt-6 md:pb-24' : 'pt-20 pb-20 md:p-6 md:pt-22 md:pb-6'}`}
          style={{ background: isAdminDashboardRoute ? '#0b0d14' : 'transparent' }}
        >
          {translatedChildren}
        </main>
        {isParentView ? (
          <BottomSidebarNav items={translatedNavItems} onLogout={handleLogout} />
        ) : null}
      </div>
    </div>
  )
}
