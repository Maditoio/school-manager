'use client'

import { BottomSidebarNav, Sidebar } from '@/components/layout/Navigation'
import Toolbar from '@/components/layout/Toolbar'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/components/ui/Toast'
import { type ClientLocale, translateText } from '@/lib/client-i18n'
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
  }>
}

export function DashboardLayout({ children, user, navItems }: LayoutProps) {
  const router = useRouter()
  const { data: session, update } = useSession()
  const { showToast } = useToast()
  const { locale, setLocale } = useLocale()
  const [theme, setTheme] = useState('light')
  const [isSavingLanguage, setIsSavingLanguage] = useState(false)
  const [desktopSidebarWidth, setDesktopSidebarWidth] = useState(240)
  const [schoolName, setSchoolName] = useState('School Dashboard')
  const [isSchoolSuspended, setIsSchoolSuspended] = useState(false)
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const isSidebarOpen = desktopSidebarWidth > 120
  const isParentView = session?.user?.role === 'PARENT' || user.role.toLowerCase() === 'parent'

  useEffect(() => {
    // Only check suspension status for non-super-admins
    if (session?.user?.role !== 'SUPER_ADMIN') {
      const checkSuspensionStatus = async () => {
        try {
          const res = await fetch('/api/schools/suspension-status')
          if (res.ok) {
            const data = await res.json()
            setIsSchoolSuspended(data.suspended)
            setSuspensionReason(data.reason)
          }
        } catch (error) {
          console.error('Failed to check school suspension status:', error)
        } finally {
          setCheckingStatus(false)
        }
      }

      checkSuspensionStatus()
    } else {
      setCheckingStatus(false)
    }
  }, [session?.user?.role])

  useEffect(() => {
    if (isSchoolSuspended) {
      router.push('/school-suspended')
    }
  }, [isSchoolSuspended, router])

  useEffect(() => {
    const schoolId = session?.user?.schoolId

    if (!schoolId) {
      if (session?.user?.role === 'SUPER_ADMIN') {
        setSchoolName('Super Admin Portal')
      }
      return
    }

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
  }, [session?.user?.role, session?.user?.schoolId])
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('ui-theme') || 'light'
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    } catch {
      setTheme('light')
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, [])

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/login')
  }

  const handleLanguageChange = async (nextLanguage: string) => {
    const nextLocale = nextLanguage as ClientLocale
    const previousLocale = locale
    setLocale(nextLocale)

    try {
      setIsSavingLanguage(true)
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
    } finally {
      setIsSavingLanguage(false)
    }
  }

  const handleThemeChange = (nextTheme: string) => {
    setTheme(nextTheme)
    try {
      localStorage.setItem('ui-theme', nextTheme)
    } catch {
      // ignore storage errors
    }
    document.documentElement.setAttribute('data-theme', nextTheme)
  }

  const handleThemeToggle = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    handleThemeChange(nextTheme)
  }

  const translatedNavItems = useMemo(() => {
    const enhancedNavItems = [...navItems]
    const isSchoolAdmin = session?.user?.role === 'SCHOOL_ADMIN' || user.role.toLowerCase() === 'school admin'

    if (isSchoolAdmin && !enhancedNavItems.some((item) => item.href === '/admin/terms')) {
      const insertAfter = enhancedNavItems.findIndex((item) => item.href === '/admin/fees')
      const termsItem = { label: 'Terms', href: '/admin/terms', icon: '🗓️' }

      if (insertAfter >= 0) {
        enhancedNavItems.splice(insertAfter + 1, 0, termsItem)
      } else {
        enhancedNavItems.push(termsItem)
      }
    }

    return enhancedNavItems.map((item) => ({ ...item, label: translateText(item.label, locale) }))
  }, [navItems, locale, session?.user?.role, user.role])

  const translatedUser = useMemo(
    () => ({
      ...user,
      role: translateText(user.role, locale),
    }),
    [user, locale]
  )

  return (
    <div className="min-h-screen bg-background ui-text-primary">
      {!isParentView ? (
        <Sidebar
          items={translatedNavItems}
          user={translatedUser}
          onLogout={handleLogout}
          onDesktopWidthChange={setDesktopSidebarWidth}
        />
      ) : null}

      <div
        className="flex min-h-screen flex-col overflow-hidden"
        style={{
          marginLeft: isParentView ? 0 : desktopSidebarWidth,
          transition: 'margin-left 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {!isParentView ? (
          <Toolbar
            sidebarOpen={isSidebarOpen}
            schoolName={schoolName}
            theme={theme}
            onThemeToggle={handleThemeToggle}
            language={locale}
            onLanguageChange={handleLanguageChange}
          />
        ) : null}
        <main className={`flex-1 overflow-auto p-4 ${isParentView ? 'pt-4 pb-24 md:pt-6 md:pb-24' : 'pt-20 pb-20 md:p-6 md:pt-22 md:pb-6'}`}>
          {children}
        </main>
        {isParentView ? (
          <BottomSidebarNav items={translatedNavItems} />
        ) : null}
      </div>
    </div>
  )
}
