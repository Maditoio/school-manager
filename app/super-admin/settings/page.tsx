'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'
import { useLocale } from '@/lib/locale-context'

export default function SuperAdminSystemSettingsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { locale } = useLocale()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [videoCoursesGloballyEnabled, setVideoCoursesGloballyEnabled] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/system-settings')
        if (!res.ok) return
        const data = await res.json()
        setVideoCoursesGloballyEnabled(data.videoCoursesGloballyEnabled !== false)
      } catch (error) {
        console.error('Failed to load system settings:', error)
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated' && session?.user?.role === 'SUPER_ADMIN') {
      fetchSettings()
    }
  }, [session?.user?.role, status])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/system-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoCoursesGloballyEnabled }),
      })

      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to update system settings', 'error')
        return
      }

      showToast('System settings updated for all schools', 'success')
    } catch (error) {
      console.error('Failed to save system settings:', error)
      showToast('Failed to update system settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const preferredLanguage = String(locale || session?.user?.preferredLanguage || 'en').toLowerCase()
  const t = useMemo(() => {
    const messages = preferredLanguage.startsWith('fr')
      ? frMessages
      : preferredLanguage.startsWith('sw')
        ? swMessages
        : enMessages
    return (key: string) => {
      const keys = key.split('.')
      let value: any = messages
      for (const k of keys) value = value?.[k]
      return value || key
    }
  }, [preferredLanguage])

  if (status === 'loading' || !session) return <div>{t('common.loading')}</div>

  const navItems = [
    { label: t('navigation.dashboard'), href: '/super-admin/dashboard', icon: '📊' },
    { label: t('navigation.schools'), href: '/super-admin/schools', icon: '🏢' },
    { label: t('navigation.users'), href: '/super-admin/users', icon: '👥' },
    { label: t('navigation.analytics'), href: '/super-admin/analytics', icon: '📈' },
    { label: 'Payments', href: '/super-admin/payments', icon: '💳' },
    { label: 'Settings', href: '/super-admin/settings', icon: '⚙️' },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || t('roles.super_admin'),
        role: t('roles.super_admin'),
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-2">Global controls that apply to every school in the platform.</p>
        </div>

        <Card className="p-6">
          {loading ? (
            <p className="text-sm text-gray-500">Loading settings...</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Enable Video Courses For All Schools</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Turning this off disables student access to course browse, enrollment, playback, ratings, and progress across the platform.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={videoCoursesGloballyEnabled}
                    onClick={() => setVideoCoursesGloballyEnabled((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${videoCoursesGloballyEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${videoCoursesGloballyEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} isLoading={saving}>Save Settings</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
