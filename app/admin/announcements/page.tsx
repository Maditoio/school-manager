'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, TextArea } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import { translateText } from '@/lib/client-i18n'
import { useLocale } from '@/lib/locale-context'

interface Announcement {
  id: string
  title: string
  message: string
  startDate: string
  endDate: string | null
  imageUrl: string | null
  priority: string
  createdAt: string
  creator?: { firstName: string; lastName: string }
}

export default function AnnouncementsPage() {
  const { data: session, status } = useSession()
  const { locale } = useLocale()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    startDate: '',
    endDate: '',
    imageUrl: '',
  })

  const t = (text: string) => translateText(text, locale)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN' && session?.user?.role !== 'DEPUTY_ADMIN') {
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
    setSaving(true)
    setError('')

    try {
      let imageUrl = formData.imageUrl

      if (imageFile) {
        const uploadFormData = new FormData()
        uploadFormData.append('file', imageFile)
        const uploadRes = await fetch('/api/announcements/image', {
          method: 'POST',
          body: uploadFormData,
        })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || t('Upload failed'))
        }
        imageUrl = uploadData.url
      }

      const url = editingAnnouncement ? `/api/announcements/${editingAnnouncement.id}` : '/api/announcements'
      const method = editingAnnouncement ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          imageUrl,
          endDate: formData.endDate || null,
          priority: editingAnnouncement?.priority || 'normal',
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        await fetchAnnouncements()
        resetForm()
      } else {
        const firstIssue = Array.isArray(data.error) ? data.error[0]?.message : data.error
        setError(firstIssue || t('Failed to save announcement'))
      }
    } catch (error) {
      console.error('Failed to save announcement:', error)
      setError(error instanceof Error ? error.message : t('Failed to save announcement'))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setFormData({
      title: announcement.title,
      message: announcement.message,
      startDate: announcement.startDate.slice(0, 10),
      endDate: announcement.endDate ? announcement.endDate.slice(0, 10) : '',
      imageUrl: announcement.imageUrl || '',
    })
    setImageFile(null)
    setImagePreview('')
  }

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError(t('Image must be smaller than 2 MB'))
      return
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setFormData((prev) => ({ ...prev, imageUrl: '' }))
  }

  const handleRemoveImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
    setImageFile(null)
    setImagePreview('')
    setFormData((prev) => ({ ...prev, imageUrl: '' }))
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
      startDate: '',
      endDate: '',
      imageUrl: '',
    })
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
    setImagePreview('')
    setImageFile(null)
    setError('')
    setEditingAnnouncement(null)
  }

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  const formatRange = (startDate: string, endDate: string | null) => {
    const start = new Date(startDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-KE' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    if (!endDate) return start

    const end = new Date(endDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-KE' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    return `${start} - ${end}`
  }

  if (status === 'loading' || !session) {
    return <div>{t('Loading...')}</div>
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('Announcements')}</h1>
            <p className="text-gray-600 mt-2">{t('Create and manage school announcements')}</p>
          </div>
          {editingAnnouncement ? (
            <Button variant="secondary" onClick={resetForm}>
              {t('New Announcement')}
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">
              {editingAnnouncement ? t('Edit Announcement') : t('New Announcement')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label={t('Title')}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder={t('Enter announcement title')}
              />
              <TextArea
                label={t('Content')}
                value={formData.message}
                onChange={(e) => {
                  setFormData({ ...formData, message: e.target.value })
                  const el = e.target as HTMLTextAreaElement
                  el.style.height = 'auto'
                  el.style.height = `${el.scrollHeight}px`
                }}
                required
                rows={3}
                style={{ overflow: 'hidden', resize: 'none' }}
                placeholder={t('Enter announcement content')}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label={t('Start Date')}
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
                <Input
                  label={t('End Date (Optional)')}
                  type="date"
                  value={formData.endDate}
                  min={formData.startDate || undefined}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">{t('Announcement Image')}</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                    onChange={handleImageChange}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                  />
                </div>

                {(imagePreview || formData.imageUrl) ? (
                  <div className="relative h-36 w-56">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview || formData.imageUrl}
                      alt={t('Announcement image preview')}
                      className="h-full w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700"
                      aria-label={t('Remove Image')}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                      </svg>
                    </button>
                  </div>
                ) : null}
              </div>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <div className="flex gap-2 justify-end">
                {editingAnnouncement ? (
                  <Button type="button" variant="secondary" onClick={resetForm}>
                    {t('Cancel')}
                  </Button>
                ) : null}
                <Button type="submit" isLoading={saving}>{editingAnnouncement ? t('Update') : t('Create')}</Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4">
            {loading ? (
              <div>{t('Loading announcements...')}</div>
            ) : announcements.length > 0 ? (
              announcements.map((announcement) => (
                <Card key={announcement.id} className="p-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900">{announcement.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {t('By')} {announcement.creator?.firstName} {announcement.creator?.lastName} • {new Date(announcement.createdAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">{t('Active')} {formatRange(announcement.startDate, announcement.endDate)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => handleEdit(announcement)}>
                          {t('Edit')}
                        </Button>
                        <Button variant="danger" onClick={() => handleDelete(announcement.id)}>
                          {t('Delete')}
                        </Button>
                      </div>
                    </div>
                    {announcement.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={announcement.imageUrl} alt={announcement.title} className="h-48 w-full rounded-xl object-cover" />
                    ) : null}
                    <p className="text-gray-700 whitespace-pre-wrap">{announcement.message}</p>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-6">
                <p className="text-center text-gray-500">{t('No announcements yet. Use the form to create one.')}</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
