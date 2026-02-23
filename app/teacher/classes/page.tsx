'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

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

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = [
    { label: 'Dashboard', href: '/teacher/dashboard', icon: '📊' },
    { label: 'My Classes', href: '/teacher/classes', icon: '🏫' },
    { label: 'Students', href: '/teacher/students', icon: '👨‍🎓' },
    { label: 'Assessments', href: '/teacher/assessments', icon: '📋' },
    { label: 'Attendance', href: '/teacher/attendance', icon: '📅' },
    { label: 'Results', href: '/teacher/results', icon: '📝' },
    { label: 'Announcements', href: '/teacher/announcements', icon: '📢' },
    { label: 'Messages', href: '/teacher/messages', icon: '💬' },
  ]

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
          <div>Loading classes...</div>
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
