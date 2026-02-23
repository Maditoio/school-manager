'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useSession } from 'next-auth/react'
import { redirect, useSearchParams } from 'next/navigation'

interface Message {
  id: string
  content: string
  createdAt: string
  read: boolean
  sender?: { firstName: string; lastName: string }
  receiver?: { firstName: string; lastName: string }
  senderId: string
  receiverId: string
}

interface Contact {
  id: string
  firstName: string
  lastName: string
  role: 'TEACHER' | 'SCHOOL_ADMIN'
}

export default function ParentMessagesPage() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messageContent, setMessageContent] = useState('')
  const [sending, setSending] = useState(false)

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
      const fetchContactsData = async () => {
        try {
          const res = await fetch('/api/users')
          if (res.ok) {
            const data = await res.json()
            const usersArray = Array.isArray(data.users) ? data.users : []
            const contactsArray = usersArray.filter(
              (user: { role?: string }) =>
                user.role === 'TEACHER' || user.role === 'SCHOOL_ADMIN'
            )

            setContacts(contactsArray)

            const preselectedContactId = searchParams.get('contactId')
            const hasPreselectedContact = preselectedContactId
              ? contactsArray.some((contact: Contact) => contact.id === preselectedContactId)
              : false

            if (hasPreselectedContact && preselectedContactId) {
              setSelectedContact(preselectedContactId)
            } else if (contactsArray.length > 0) {
              setSelectedContact(contactsArray[0].id)
            }
          } else {
            setContacts([])
          }
        } catch (error) {
          console.error('Failed to fetch contacts:', error)
          setContacts([])
        } finally {
          setLoading(false)
        }
      }
      fetchContactsData()
    }
  }, [session, searchParams])

  useEffect(() => {
    if (selectedContact) {
      setMessagesLoading(true)
      const fetchMessagesData = async () => {
        try {
          const res = await fetch(`/api/messages?otherUserId=${selectedContact}&type=all`)
          if (res.ok) {
            const data = await res.json()
            const fetchedMessages = Array.isArray(data.messages) ? data.messages : []
            setMessages(fetchedMessages)

            const unreadIncomingIds = fetchedMessages
              .filter(
                (message: Message) =>
                  message.receiverId === session?.user?.id && message.read === false
              )
              .map((message: Message) => message.id)

            if (unreadIncomingIds.length > 0) {
              await Promise.allSettled(
                unreadIncomingIds.map((messageId: string) =>
                  fetch(`/api/messages/${messageId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ read: true }),
                  })
                )
              )

              setMessages((current) =>
                current.map((message) =>
                  unreadIncomingIds.includes(message.id)
                    ? { ...message, read: true }
                    : message
                )
              )
            }
          } else {
            setMessages([])
          }
        } catch (error) {
          console.error('Failed to fetch messages:', error)
          setMessages([])
        } finally {
          setMessagesLoading(false)
        }
      }
      fetchMessagesData()
    }
  }, [selectedContact, session?.user?.id])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageContent.trim() || !selectedContact) return

    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageContent,
          receiverId: selectedContact,
        }),
      })
      if (res.ok) {
        setMessageContent('')
        // Refresh messages after sending
        const messagesRes = await fetch(`/api/messages?otherUserId=${selectedContact}&type=all`)
        if (messagesRes.ok) {
          const data = await messagesRes.json()
          setMessages(Array.isArray(data.messages) ? data.messages : [])
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getContactName = () => {
    const contact = contacts.find((item) => item.id === selectedContact)
    if (!contact) return 'Select Contact'
    return `${contact.firstName} ${contact.lastName}`
  }

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = [
    { label: 'Dashboard', href: '/parent/dashboard', icon: '🏠' },
    { label: 'My Children', href: '/parent/children', icon: '👨‍👩‍👧‍👦' },
    { label: 'Attendance', href: '/parent/attendance', icon: '📅' },
    { label: 'Results', href: '/parent/results', icon: '📊' },
    { label: 'Assessments', href: '/parent/assessments', icon: '📋' },
    { label: 'Announcements', href: '/parent/announcements', icon: '📢' },
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
      <div className="min-h-screen bg-linear-to-b from-emerald-50 via-white to-blue-50">
        <div className="mx-auto w-full max-w-md space-y-5 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] px-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Messages
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Chat with Teachers</h1>
          </section>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-xl bg-linear-to-r from-slate-100 to-slate-200 h-12 animate-pulse"></div>
                ))}
              </div>
            </div>
          ) : messagesLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-xl bg-linear-to-r from-slate-100 to-slate-200 h-12 animate-pulse"></div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="block text-xs font-semibold text-slate-700 mb-2">Select Contact</label>
                <select
                  value={selectedContact}
                  onChange={(e) => setSelectedContact(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select a contact</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.firstName} {contact.lastName} ({contact.role === 'TEACHER' ? 'Teacher' : 'Admin'})
                    </option>
                  ))}
                </select>
              </section>

              {selectedContact && (
                <>
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-slate-900">
                        {getContactName()}
                      </h2>
                      <span className="rounded-full bg-linear-to-r from-slate-100 to-slate-50 px-3 py-1 text-xs text-slate-500 border border-slate-200">
                        {messages.length}
                      </span>
                    </div>

                    <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                      {messages.length > 0 ? (
                        messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.senderId === session.user.id ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`rounded-2xl px-4 py-2 max-w-xs shadow-xs ${
                                message.senderId === session.user.id
                                  ? 'bg-emerald-500 text-white border border-emerald-600'
                                  : 'bg-linear-to-br from-white to-slate-50 border border-slate-200 text-slate-900'
                              }`}
                            >
                              <p className="text-sm whitespace-normal break-all">{message.content}</p>
                              <p className={`text-xs mt-1 ${message.senderId === session.user.id ? 'text-emerald-100' : 'text-slate-400'}`}>
                                {formatDateTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6">
                          <div className="text-3xl mb-2">💬</div>
                          <p className="text-sm text-slate-500">No messages yet. Start the conversation!</p>
                        </div>
                      )}
                    </div>
                  </section>

                  <form onSubmit={handleSendMessage} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-0"
                        disabled={sending}
                      />
                      <button
                        type="submit"
                        disabled={sending || !messageContent.trim()}
                        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                      >
                        {sending ? '...' : '📤'}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {!selectedContact && (
                <section className="rounded-2xl border border-dashed border-slate-300 bg-linear-to-br from-slate-50 to-slate-100 p-6 text-center">
                  <div className="text-4xl mb-2">👋</div>
                  <p className="text-sm text-slate-600">Select a contact to start messaging</p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
