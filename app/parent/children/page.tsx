'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

interface Student {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string
  dateOfBirth: string
  gender: string
  class?: { name: string }
}

export default function ParentChildrenPage() {
  const { data: session, status } = useSession()
  const [children, setChildren] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'PARENT') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session) {
      const fetchChildren = async () => {
        try {
          const res = await fetch('/api/students?parentId=' + session?.user?.id)
          if (res.ok) {
            const data = await res.json()
            setChildren(Array.isArray(data.students) ? data.students : [])
          } else {
            setChildren([])
          }
        } finally {
          setLoading(false)
        }
      }
      fetchChildren()
    }
  }, [session])

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = [
    { label: 'Dashboard', href: '/parent/dashboard', icon: '🏠' },
    { label: 'Attendance', href: '/parent/attendance', icon: '📅' },
    { label: 'Results', href: '/parent/results', icon: '📊' },
    { label: 'Messages', href: '/parent/messages', icon: '💬' },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Parent',
        role: 'Parent',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Children</h1>
          <p className="text-gray-600 mt-2">View information about your children</p>
        </div>

        {loading ? (
          <div>Loading children...</div>
        ) : children.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {children.map((child) => (
              <Card key={child.id} className="p-6">
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {child.firstName} {child.lastName}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>📝 Admission No: {child.admissionNumber}</p>
                    <p>🏫 Class: {child.class?.name || 'N/A'}</p>
                    <p>🎂 DOB: {new Date(child.dateOfBirth).toLocaleDateString()}</p>
                    <p>👤 Gender: {child.gender}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-gray-500">No children registered</p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
