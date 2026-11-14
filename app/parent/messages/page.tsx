'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  ParentCard,
  ParentPageHeader,
  ParentShell,
} from '@/components/parent/ParentShell'
import { PARENT_NAV_ITEMS } from '@/lib/admin-nav'
import { useParentUi } from '@/lib/use-parent-ui'
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

function ParentMessagesContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const { locale, tParent } = useParentUi()
  const [messages, setMessages] = useState<Message[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messageContent, setMessageContent] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session && session.user.role !== 'PARENT') redirect('/login')
  }, [session, status])

  useEffect(() => {
    if (!session) return

    const fetchContactsData = async () => {
      try {
        const res = await fetch('/api/users')
        if (res.ok) {
          const data = await res.json()
          const usersArray = Array.isArray(data.users) ? data.users : []
          const contactsArray = usersArray.filter(
            (user: { role?: string }) =>
              user.role === 'TEACHER' || user.role === 'SCHOOL_ADMIN'
          ) as Contact[]

          setContacts(contactsArray)

          const preselectedContactId = searchParams.get('contactId')
          const hasPreselectedContact = preselectedContactId
            ? contactsArray.some((contact) => contact.id === preselectedContactId)
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
  }, [session, searchParams])

  useEffect(() => {
    if (!selectedContact) return

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
                unreadIncomingIds.includes(message.id) ? { ...message, read: true } : message
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
  }, [selectedContact, session?.user?.id])

  const handleSendMessage = async (e: FormEvent) => {
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
    const dateLocale = locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-TZ' : 'en-GB'
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })
  }

  if (status === 'loading' || !session) {
    return (
      <ParentShell>
        <ParentCard>
          <p className="text-sm ui-text-secondary">{tParent('loading', 'Loading…')}</p>
        </ParentCard>
      </ParentShell>
    )
  }

  const selected = contacts.find((c) => c.id === selectedContact)

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Parent',
        role: 'Parent',
        email: session.user.email,
      }}
      navItems={PARENT_NAV_ITEMS}
    >
      <ParentShell>
        <ParentPageHeader
          title={tParent('messagesTitle', 'Messages')}
          subtitle={tParent('messagesSubtitle', 'Message teachers and school admin')}
        />

        {loading ? (
          <ParentCard>
            <p className="text-sm ui-text-secondary">{tParent('loading', 'Loading…')}</p>
          </ParentCard>
        ) : (
          <>
            <ParentCard>
              <label className="flex min-w-[220px] max-w-md flex-col gap-1">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] ui-text-secondary">
                  {tParent('contact', 'Contact')}
                </span>
                <select
                  className="ui-select h-8 min-h-8 py-0"
                  value={selectedContact}
                  onChange={(e) => setSelectedContact(e.target.value)}
                >
                  <option value="">{tParent('selectContact', 'Select a contact')}</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.firstName} {contact.lastName} (
                      {contact.role === 'TEACHER'
                        ? tParent('teacherRole', 'Teacher')
                        : tParent('adminRole', 'Admin')}
                      )
                    </option>
                  ))}
                </select>
              </label>
            </ParentCard>

            {selectedContact ? (
              <>
                <ParentCard>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold ui-text-primary">
                      {selected
                        ? `${selected.firstName} ${selected.lastName}`
                        : tParent('conversation', 'Conversation')}
                    </h2>
                    <span className="text-xs ui-text-secondary">{messages.length}</span>
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {messagesLoading ? (
                      <p className="text-sm ui-text-secondary">{tParent('loading', 'Loading…')}</p>
                    ) : messages.length > 0 ? (
                      messages.map((message) => {
                        const mine = message.senderId === session.user.id
                        return (
                          <div
                            key={message.id}
                            className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-[6px] border px-3 py-2 ${
                                mine
                                  ? 'border-[#c9c5ff] bg-[#f0effe] ui-text-primary'
                                  : 'border-(--border-subtle) bg-(--surface-soft) ui-text-primary'
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words text-sm">
                                {message.content}
                              </p>
                              <p className="mt-1 text-[0.6875rem] ui-text-secondary">
                                {formatDateTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-sm ui-text-secondary">
                        {tParent('noMessagesStart', 'No messages yet. Start the conversation.')}
                      </p>
                    )}
                  </div>
                </ParentCard>

                <ParentCard>
                  <form onSubmit={handleSendMessage} className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      placeholder={tParent('writeMessage', 'Write a message…')}
                      className="ui-input min-w-0 flex-1"
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={sending || !messageContent.trim()}
                      className="ui-button ui-button-primary"
                    >
                      {sending ? tParent('sending', 'Sending…') : tParent('send', 'Send')}
                    </button>
                  </form>
                </ParentCard>
              </>
            ) : (
              <ParentCard>
                <p className="text-sm ui-text-secondary">
                  {contacts.length === 0
                    ? tParent('noContacts', 'No contacts available yet.')
                    : tParent('selectContactPrompt', 'Select a contact to get started.')}
                </p>
              </ParentCard>
            )}
          </>
        )}
      </ParentShell>
    </DashboardLayout>
  )
}

export default function ParentMessagesPage() {
  return (
    <Suspense fallback={<ParentMessagesFallback />}>
      <ParentMessagesContent />
    </Suspense>
  )
}

function ParentMessagesFallback() {
  const { tParent } = useParentUi()
  return (
    <ParentShell>
      <ParentCard>
        <p className="text-sm ui-text-secondary">{tParent('loading', 'Loading…')}</p>
      </ParentCard>
    </ParentShell>
  )
}
