'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

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

interface ClassMoveLog {
  id: string
  studentId: string
  fromClassId: string | null
  toClassId: string
  reason: string | null
  effectiveAt: string
  createdAt: string
  student: {
    firstName: string
    lastName: string
    admissionNumber: string | null
  }
  fromClass: {
    name: string
  } | null
  toClass: {
    name: string
  }
  changedBy: {
    firstName: string | null
    lastName: string | null
    email: string
  } | null
}

interface SchoolAuditLog {
  id: string
  schoolId: string
  actorId: string | null
  resourceType: string
  resourceId: string
  action: string
  summary: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  actor: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  } | null
}

export default function AdminInteractionLogsPage() {
  const { data: session, status } = useSession()
  const [logs, setLogs] = useState<InteractionLog[]>([])
  const [classMoveLogs, setClassMoveLogs] = useState<ClassMoveLog[]>([])
  const [auditLogs, setAuditLogs] = useState<SchoolAuditLog[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN' && session?.user?.role !== 'DEPUTY_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session?.user?.role === 'SCHOOL_ADMIN' || session?.user?.role === 'DEPUTY_ADMIN') {
      void Promise.all([fetchLogs(), fetchClassMoveLogs(), fetchAuditLogs(), fetchChildren()]).finally(
        () => setLoading(false)
      )
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
    }
  }

  const fetchClassMoveLogs = async () => {
    try {
      const res = await fetch('/api/class-move-logs?take=200')
      if (res.ok) {
        const data = await res.json()
        setClassMoveLogs(Array.isArray(data.logs) ? data.logs : [])
      }
    } catch (error) {
      console.error('Failed to fetch class move logs:', error)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/school-audit-logs?take=200')
      if (res.ok) {
        const data = await res.json()
        setAuditLogs(Array.isArray(data.logs) ? data.logs : [])
      }
    } catch (error) {
      console.error('Failed to fetch school audit logs:', error)
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

  const studentDeletionLogs = useMemo(
    () => auditLogs.filter((log) => log.resourceType === 'student' && log.action === 'delete'),
    [auditLogs]
  )

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = session?.user?.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session?.user?.role === 'DEPUTY_ADMIN' ? 'Deputy Admin' : 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-[1.25rem] font-semibold ui-text-primary">Interaction Logs</h1>
          <p className="mt-1 ui-text-secondary">
            Parent activity, class moves, and permanent student deletions
          </p>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-(--border-subtle) px-4 py-3">
            <h2 className="text-[0.875rem] font-semibold ui-text-primary">Student deletions</h2>
            <p className="mt-0.5 text-[0.75rem] ui-text-secondary">
              Permanent removals from the school (kept after the student record is gone)
            </p>
          </div>
          {loading ? (
            <div className="p-6 ui-text-secondary">Loading deletion logs...</div>
          ) : studentDeletionLogs.length === 0 ? (
            <div className="p-6 ui-text-secondary">No student deletions logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ui-table no-table-stripes min-w-full">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Deleted by</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {studentDeletionLogs.map((log) => {
                    const meta = log.metadata || {}
                    const studentLabel =
                      log.summary ||
                      [meta.firstName, meta.lastName].filter(Boolean).join(' ') ||
                      log.resourceId
                    const admission =
                      typeof meta.admissionNumber === 'string' && meta.admissionNumber
                        ? ` (${meta.admissionNumber})`
                        : ''
                    const className =
                      typeof meta.className === 'string' && meta.className ? meta.className : '—'
                    const actorLabel = log.actor
                      ? `${log.actor.firstName || ''} ${log.actor.lastName || ''}`.trim() ||
                        log.actor.email
                      : 'System'

                    return (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td>
                          {studentLabel}
                          {admission && !String(studentLabel).includes(String(meta.admissionNumber))
                            ? admission
                            : ''}
                        </td>
                        <td>{className}</td>
                        <td>{actorLabel}</td>
                        <td className="text-[0.75rem] ui-text-secondary">
                          {meta.hadLogin ? 'Had login · ' : ''}
                          ID: {log.resourceId}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-(--border-subtle) px-4 py-3">
            <h2 className="text-[0.875rem] font-semibold ui-text-primary">Parent interactions</h2>
            <p className="mt-0.5 text-[0.75rem] ui-text-secondary">
              Parent clicks on dashboard announcements and assessments
            </p>
          </div>
          {loading ? (
            <div className="p-6 ui-text-secondary">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-6 ui-text-secondary">No interaction logs yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ui-table no-table-stripes min-w-full">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Parent</th>
                    <th>Child</th>
                    <th>Resource</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const parentName =
                      `${log.parent?.firstName || ''} ${log.parent?.lastName || ''}`.trim() ||
                      log.parent?.email ||
                      'Unknown'
                    const childLabel = log.childId
                      ? childNameById.get(log.childId) || log.childId
                      : '-'
                    return (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td>{parentName}</td>
                        <td>{childLabel}</td>
                        <td>
                          <span className="ui-status ui-status-neutral uppercase">
                            {log.resourceType}
                          </span>
                        </td>
                        <td>{log.action}</td>
                        <td className="text-[0.75rem] ui-text-secondary">
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

        <Card className="overflow-hidden p-0">
          <div className="border-b border-(--border-subtle) px-4 py-3">
            <h2 className="text-[0.875rem] font-semibold ui-text-primary">Class moves</h2>
          </div>
          {loading ? (
            <div className="p-6 ui-text-secondary">Loading class move logs...</div>
          ) : classMoveLogs.length === 0 ? (
            <div className="p-6 ui-text-secondary">No class move logs yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ui-table no-table-stripes min-w-full">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Student</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Changed By</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {classMoveLogs.map((log) => {
                    const studentLabel = `${log.student.firstName} ${log.student.lastName}${
                      log.student.admissionNumber ? ` (${log.student.admissionNumber})` : ''
                    }`
                    const changedByLabel = log.changedBy
                      ? `${log.changedBy.firstName || ''} ${log.changedBy.lastName || ''}`.trim() ||
                        log.changedBy.email
                      : 'System'

                    return (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td>{studentLabel}</td>
                        <td>{log.fromClass?.name || '-'}</td>
                        <td>{log.toClass?.name || '-'}</td>
                        <td>{changedByLabel}</td>
                        <td>{log.reason || '-'}</td>
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
