'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'

interface InteractionLog {
  id: string
  parentId: string
  childId: string | null
  resourceType: string
  resourceId: string
  action: string
  metadata: Record<string, unknown> | null
  createdAt: string
  parent: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  }
}

interface Child {
  id: string
  firstName: string
  lastName: string
  admissionNumber?: string | null
}

export default function AdminInteractionLogsPage() {
  const { data: session, status } = useSession()
  const [logs, setLogs] = useState<InteractionLog[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session?.user?.role === 'SCHOOL_ADMIN') {
      fetchLogs()
      fetchChildren()
    }
  }, [session])

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/parent-interactions?take=200')
      if (res.ok) {
        const data = await res.json()
        setLogs(Array.isArray(data.logs) ? data.logs : [])
      }
    } catch (error) {
      console.error('Failed to fetch interaction logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchChildren = async () => {
    try {
      const res = await fetch('/api/students')
      if (res.ok) {
        const data = await res.json()
        setChildren(Array.isArray(data.students) ? data.students : [])
      }
    } catch (error) {
      console.error('Failed to fetch students:', error)
    }
  }

  const childNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const child of children) {
      map.set(
        child.id,
        `${child.firstName} ${child.lastName}${child.admissionNumber ? ` (${child.admissionNumber})` : ''}`
      )
    }
    return map
  }, [children])

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { label: 'Students', href: '/admin/students', icon: '👨‍🎓' },
    { label: 'Teachers', href: '/admin/teachers', icon: '👨‍🏫' },
    { label: 'Classes', href: '/admin/classes', icon: '🏫' },
    { label: 'Subjects', href: '/admin/subjects', icon: '📚' },
    { label: 'Attendance', href: '/admin/attendance', icon: '📅' },
    { label: 'Results', href: '/admin/results', icon: '📝' },
    { label: 'Announcements', href: '/admin/announcements', icon: '📢' },
    { label: 'Messages', href: '/admin/messages', icon: '💬' },
    { label: 'Interaction Logs', href: '/admin/interaction-logs', icon: '🕵️' },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Parent Interaction Logs</h1>
          <p className="text-gray-600 mt-2">Track parent clicks on dashboard announcements and assessments</p>
        </div>

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-6">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-gray-500">No interaction logs yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Parent</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Child</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Resource</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {logs.map((log) => {
                    const parentName = `${log.parent?.firstName || ''} ${log.parent?.lastName || ''}`.trim() || log.parent?.email || 'Unknown'
                    const childLabel = log.childId ? childNameById.get(log.childId) || log.childId : '-'
                    return (
                      <tr key={log.id}>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{parentName}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{childLabel}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 uppercase text-xs font-medium">
                            {log.resourceType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{log.action}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          <div>ID: {log.resourceId}</div>
                          {log.metadata ? (
                            <div className="mt-1">{JSON.stringify(log.metadata)}</div>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
