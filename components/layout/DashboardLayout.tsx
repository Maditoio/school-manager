'use client'

import { Sidebar, MobileNav } from '@/components/layout/Navigation'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/components/ui/Toast'

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
  const [preferredLanguage, setPreferredLanguage] = useState('en')
  const [theme, setTheme] = useState('light')
  const [isSavingLanguage, setIsSavingLanguage] = useState(false)

  useEffect(() => {
    if (session?.user?.preferredLanguage) {
      setPreferredLanguage(session.user.preferredLanguage)
    }
  }, [session?.user?.preferredLanguage])

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
    setPreferredLanguage(nextLanguage)

    try {
      setIsSavingLanguage(true)
      const res = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLanguage: nextLanguage }),
      })

      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'Failed to save language preference', 'error')
        if (session?.user?.preferredLanguage) {
          setPreferredLanguage(session.user.preferredLanguage)
        }
        return
      }

      document.cookie = `NEXT_LOCALE=${nextLanguage}; path=/; max-age=${60 * 60 * 24 * 365}`
      await update({ preferredLanguage: nextLanguage })
      showToast('Language preference saved', 'success')
    } catch (error) {
      console.error('Failed to update language preference:', error)
      showToast('Failed to save language preference', 'error')
      if (session?.user?.preferredLanguage) {
        setPreferredLanguage(session.user.preferredLanguage)
      }
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

  return (
    <div className="flex h-screen bg-background ui-text-primary">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 shrink-0">
        <Sidebar items={navItems} user={user} onLogout={handleLogout} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-(--border-subtle) bg-(--surface-soft) px-4 py-4 md:px-8 flex items-center justify-end">
          <div className="flex items-center gap-3">
            <label htmlFor="theme-select" className="text-sm ui-text-secondary">
              Theme
            </label>
            <select
              id="theme-select"
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value)}
              className="ui-select w-32"
            >
              <option value="light">Light</option>
              <option value="calm">Calm</option>
              <option value="dark">Dark</option>
            </select>

            <label htmlFor="language-select" className="text-sm ui-text-secondary">
              Language
            </label>
            <select
              id="language-select"
              value={preferredLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isSavingLanguage}
              className="ui-select w-32"
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="sw">Kiswahili</option>
            </select>
          </div>
        </div>
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav items={navItems} />
    </div>
  )
}
