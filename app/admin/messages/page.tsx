'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, TextArea } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

type Student = {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string | null
  class?: {
    id: string
    name: string
  }
  parentId: string | null
  parentName?: string | null
  parentEmail?: string | null
  parent?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  } | null
}

export default function AdminMessagesPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [students, setStudents] = useState<Student[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [content, setContent] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  const searchStudents = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      setStudents([])
      return
    }

    try {
      setLoading(true)
      const params = new URLSearchParams({
        q: trimmed,
        page: '1',
        pageSize: '20',
      })

      const res = await fetch(`/api/students?${params.toString()}`)
      if (!res.ok) {
        setStudents([])
        return
      }

      const data = await res.json()
      setStudents(Array.isArray(data.students) ? data.students : [])
    } catch (error) {
      console.error('Failed to search students:', error)
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchStudents(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, searchStudents])

  const parentDisplay = useMemo(() => {
    if (!selectedStudent) return '—'

    if (selectedStudent.parent) {
      return `${selectedStudent.parent.firstName || ''} ${selectedStudent.parent.lastName || ''}`.trim() || selectedStudent.parent.email
    }

    return selectedStudent.parentName || selectedStudent.parentEmail || 'No linked parent account'
  }, [selectedStudent])

  const linkedParentId = selectedStudent?.parentId || selectedStudent?.parent?.id || null

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedStudent) {
      showToast('Select a student first', 'warning')
      return
    }

    if (!linkedParentId) {
      showToast('Selected student has no linked parent user account', 'error')
      return
    }

    if (!content.trim()) {
      showToast('Message content is required', 'warning')
      return
    }

    try {
      setSending(true)
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: linkedParentId,
          content: content.trim(),
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to send message', 'error')
        return
      }

      setContent('')
      showToast('Message sent to parent', 'success')
    } catch (error) {
      console.error('Failed to send message:', error)
      showToast('Failed to send message', 'error')
    } finally {
      setSending(false)
    }
  }

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = ADMIN_NAV_ITEMS

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
          <h1 className="text-3xl font-bold text-gray-900">Send Message to Parent</h1>
          <p className="text-gray-600 mt-2">Search for a student, select them, then send a message to their linked parent.</p>
        </div>

        <Card className="p-6 space-y-4">
          <Input
            label="Search Student"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type student name or admission number"
          />

          {loading ? (
            <p className="text-sm text-gray-600">Searching students...</p>
          ) : students.length > 0 ? (
            <div className="max-h-72 overflow-auto border border-gray-200 rounded-lg">
              {students.map((student) => {
                const parentText =
                  student.parentName ||
                  (student.parent
                    ? `${student.parent.firstName || ''} ${student.parent.lastName || ''}`.trim() || student.parent.email
                    : student.parentEmail || 'No linked parent')

                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedStudent(student)}
                    className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 ${
                      selectedStudent?.id === student.id ? 'bg-blue-50' : 'bg-white'
                    }`}
                  >
                    <p className="font-medium text-gray-900">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="text-xs text-gray-600">
                      {student.admissionNumber || 'No admission number'}
                      {student.class?.name ? ` • ${student.class.name}` : ''}
                    </p>
                    <p className="text-xs text-gray-600">Parent: {parentText}</p>
                  </button>
                )
              })}
            </div>
          ) : searchTerm.trim().length >= 3 ? (
            <p className="text-sm text-gray-600">No matching students found.</p>
          ) : null}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Compose Message</h2>
          <p className="text-sm text-gray-700 mb-4">
            To: <span className="font-medium">{parentDisplay}</span>
          </p>
          <form onSubmit={handleSend} className="space-y-4">
            <TextArea
              label="Message"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Type your message to parent..."
              required
            />
            <div className="flex justify-end">
              <Button type="submit" isLoading={sending}>
                Send Message
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  )
}
