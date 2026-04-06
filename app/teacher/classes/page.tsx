'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'

interface Class {
  id: string
  name: string
  _count?: { students: number }
}

export default function TeacherClassesPage() {
  const { data: session, status } = useSession()
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'TEACHER') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session) {
      fetchClasses()
    }
  }, [session])

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes?teacherId=' + session?.user?.id)
      if (res.ok) {
        const data = await res.json()
        setClasses(Array.isArray(data.classes) ? data.classes : [])
      } else {
        setClasses([])
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error)
      setClasses([])
    } finally {
      setLoading(false)
    }
  }

  const loadingIndicator = (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-2xl border border-(--border-subtle) bg-(--surface-soft) px-8 py-6 shadow-[0_12px_36px_rgba(2,6,23,0.14)]">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-(--border-subtle) border-t-(--accent)" />
          <p className="text-sm font-medium ui-text-primary">Loading classes...</p>
        </div>
      </div>
    </div>
  )

  if (status === 'loading' || !session) {
    return loadingIndicator
  }

  const navItems = TEACHER_NAV_ITEMS

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Teacher',
        role: 'Teacher',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Classes</h1>
          <p className="text-gray-600 mt-2">Classes you are teaching</p>
        </div>

        {loading ? (
          loadingIndicator
        ) : classes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <Card key={cls.id} className="p-6">
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-gray-900">{cls.name}</h3>
                  <p className="text-gray-600">👨‍🎓 Students: {cls._count?.students || 0}</p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-gray-500">No classes assigned yet</p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
