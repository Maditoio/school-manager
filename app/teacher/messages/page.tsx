'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select, TextArea } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { TEACHER_NAV_ITEMS } from '@/lib/admin-nav'
import { useAlert } from '@/lib/useAlertDialog'

interface Message {
  id: string
  senderId: string
  receiverId: string
  content: string
  imageUrl?: string | null
  read: boolean
  createdAt: string
  sender?: { firstName: string; lastName: string; role: string }
  receiver?: { firstName: string; lastName: string; role: string }
}

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

interface StudentSearchResult {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string | null
  parentId: string | null
  parentName?: string | null
  parentEmail?: string | null
  parent?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  } | null
  class?: {
    id: string
    name: string
  }
}

export default function TeacherMessagesPage() {
  const { data: session, status } = useSession()
  const { showAlert } = useAlert()
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [search, setSearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([])
  const [searchingStudents, setSearchingStudents] = useState(false)
  const [selectedStudentLabel, setSelectedStudentLabel] = useState('')
  const [formData, setFormData] = useState({
    receiverId: '',
    content: '',
    imageUrl: '',
  })
  const lastMarkedRef = useRef('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

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
      fetchMessages()
      fetchUsers()
    }
  }, [session])

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/messages?type=all')
      if (res.ok) {
        const data = await res.json()
        setMessages(Array.isArray(data.messages) ? data.messages : [])
      } else {
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users?role=PARENT')
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data.users) ? data.users : []
        const filtered = list.filter((user: User) => user.id !== session?.user?.id)
        setUsers(filtered)
      } else {
        setUsers([])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
      setUsers([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        await fetchMessages()
        setShowModal(false)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      })

      if (res.ok) {
        await fetchMessages()
      }
    } catch (error) {
      console.error('Failed to mark message as read:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      receiverId: '',
      content: '',
      imageUrl: '',
    })
    setStudentSearch('')
    setStudentResults([])
    setSelectedStudentLabel('')
  }

  useEffect(() => {
    if (!showModal) return

    const query = studentSearch.trim()
    if (query.length < 3) {
      setStudentResults([])
      return
    }

    const timeout = setTimeout(async () => {
      try {
        setSearchingStudents(true)
        const params = new URLSearchParams({
          q: query,
          page: '1',
          pageSize: '15',
        })

        const res = await fetch(`/api/students?${params.toString()}`)
        if (!res.ok) {
          setStudentResults([])
          return
        }

        const data = await res.json()
        setStudentResults(Array.isArray(data.students) ? data.students : [])
      } catch (error) {
        console.error('Failed to search students:', error)
        setStudentResults([])
      } finally {
        setSearchingStudents(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [studentSearch, showModal])

  const selectStudentParent = async (student: StudentSearchResult) => {
    const parentId = student.parentId || student.parent?.id || ''

    if (!parentId) {
      await showAlert({ title: 'No Parent Account', message: 'Selected student has no linked parent account.', variant: 'warning' })
      return
    }

    setFormData((prev) => ({ ...prev, receiverId: parentId }))
    setSelectedStudentLabel(
      `${student.firstName} ${student.lastName}${student.admissionNumber ? ` (${student.admissionNumber})` : ''}`
    )
  }

  const filteredMessages = messages.filter((msg) => {
    if (filter === 'sent') return msg.senderId === session?.user?.id
    if (filter === 'received') return msg.receiverId === session?.user?.id
    return true
  })

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
            <p className="text-gray-600 mt-2">Communicate with parents and admins</p>
          </div>
          <Button onClick={() => { resetForm(); setShowModal(true) }}>
            New Message
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'primary' : 'secondary'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'sent' ? 'primary' : 'secondary'}
            onClick={() => setFilter('sent')}
          >
            Sent
          </Button>
          <Button
            variant={filter === 'received' ? 'primary' : 'secondary'}
            onClick={() => setFilter('received')}
          >
            Received
          </Button>
        </div>

        {loading ? (
          <div>Loading messages...</div>
        ) : filteredMessages.length > 0 ? (
          <div className="space-y-4">
            {filteredMessages.map((message) => (
              <Card key={message.id} className="p-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {message.senderId === session.user.id ? 'To' : 'From'}:{' '}
                          {message.senderId === session.user.id
                            ? `${message.receiver?.firstName} ${message.receiver?.lastName}`
                            : `${message.sender?.firstName} ${message.sender?.lastName}`}
                        </span>
                        {!message.read && message.receiverId === session.user.id && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">New</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(message.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!message.read && message.receiverId === session.user.id && (
                      <Button variant="secondary" onClick={() => handleMarkAsRead(message.id)}>
                        Mark Read
                      </Button>
                    )}
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-gray-500">No messages found. Click &quot;New Message&quot; to send one.</p>
          </Card>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">New Message</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Find Child</label>
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Type child name or admission number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                  />
                  {searchingStudents ? (
                    <p className="mt-2 text-xs text-gray-600">Searching students...</p>
                  ) : null}

                  {studentResults.length > 0 ? (
                    <div className="mt-2 max-h-48 overflow-auto border border-gray-200 rounded-lg">
                      {studentResults.map((student) => {
                        const parentText =
                          student.parentName ||
                          (student.parent
                            ? `${student.parent.firstName || ''} ${student.parent.lastName || ''}`.trim() || student.parent.email
                            : student.parentEmail || 'No linked parent')

                        return (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => selectStudentParent(student)}
                            className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-gray-50"
                          >
                            <p className="text-sm font-medium text-gray-900">
                              {student.firstName} {student.lastName}
                              {student.admissionNumber ? ` (${student.admissionNumber})` : ''}
                            </p>
                            <p className="text-xs text-gray-600">
                              {student.class?.name ? `Class: ${student.class.name} • ` : ''}Parent: {parentText}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>

                {selectedStudentLabel ? (
                  <p className="text-xs text-green-700">Selected child: {selectedStudentLabel}</p>
                ) : null}

                <Select
                  label="Recipient"
                  value={formData.receiverId}
                  onChange={(e) => setFormData({ ...formData, receiverId: e.target.value })}
                  required
                >
                  <option value="">Select Recipient</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.role}) - {user.email}
                    </option>
                  ))}
                </Select>
                <TextArea
                  label="Message"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                  rows={6}
                  placeholder="Type your message here..."
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { setShowModal(false); resetForm() }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Send</Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
