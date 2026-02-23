'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, TextArea } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

interface Announcement {
  id: string
  title: string
  message: string
  createdAt: string
  creator?: { firstName: string; lastName: string }
}

export default function AnnouncementsPage() {
  const { data: session, status } = useSession()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    message: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session) {
      fetchAnnouncements()
    }
  }, [session])

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements')
      if (res.ok) {
        const data = await res.json()
        setAnnouncements(Array.isArray(data.announcements) ? data.announcements : [])
      } else {
        setAnnouncements([])
      }
    } catch (error) {
      console.error('Failed to fetch announcements:', error)
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingAnnouncement ? `/api/announcements/${editingAnnouncement.id}` : '/api/announcements'
      const method = editingAnnouncement ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        await fetchAnnouncements()
        resetForm()
      }
    } catch (error) {
      console.error('Failed to save announcement:', error)
    }
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setFormData({
      title: announcement.title,
      message: announcement.message,
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return
    
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchAnnouncements()
      }
    } catch (error) {
      console.error('Failed to delete announcement:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
    })
    setEditingAnnouncement(null)
  }

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Announcements</h1>
            <p className="text-gray-600 mt-2">Create and manage school announcements</p>
          </div>
          {editingAnnouncement ? (
            <Button variant="secondary" onClick={resetForm}>
              New Announcement
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">
              {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="Enter announcement title"
              />
              <TextArea
                label="Content"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                rows={8}
                placeholder="Enter announcement content"
              />
              <div className="flex gap-2 justify-end">
                {editingAnnouncement ? (
                  <Button type="button" variant="secondary" onClick={resetForm}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit">{editingAnnouncement ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4">
            {loading ? (
              <div>Loading announcements...</div>
            ) : announcements.length > 0 ? (
              announcements.map((announcement) => (
                <Card key={announcement.id} className="p-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900">{announcement.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          By {announcement.creator?.firstName} {announcement.creator?.lastName} • {new Date(announcement.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => handleEdit(announcement)}>
                          Edit
                        </Button>
                        <Button variant="danger" onClick={() => handleDelete(announcement.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{announcement.message}</p>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-6">
                <p className="text-center text-gray-500">No announcements yet. Use the form to create one.</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
