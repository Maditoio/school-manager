'use client'

import { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'
import { useLocale } from '@/lib/locale-context'

interface School {
  id: string
  name: string
  address: string
  phone: string
  email: string
  subscriptionPlan: string
  subscriptionStatus: string
  active: boolean
  createdAt: string
  suspended: boolean
  suspensionReason?: string
  suspendedAt?: string
}

export default function SchoolsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { locale } = useLocale()
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSchool, setEditingSchool] = useState<School | null>(null)
    const [showSuspensionModal, setShowSuspensionModal] = useState(false)
    const [suspensionAction, setSuspensionAction] = useState<{ schoolId: string; action: 'suspend' | 'unsuspend' } | null>(null)
    const [suspensionReason, setSuspensionReason] = useState('')
    const [suspensionLoading, setSuspensionLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    plan: 'BASIC',
    adminEmail: '',
    adminPassword: '',
    adminFirstName: '',
    adminLastName: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SUPER_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    fetchSchools()
  }, [])

  const fetchSchools = async () => {
    try {
      const res = await fetch('/api/schools')
      if (res.ok) {
        const data = await res.json()
        // API returns { schools: [...] }
        setSchools(Array.isArray(data.schools) ? data.schools : [])
      } else {
        setSchools([])
      }
    } catch (error) {
      console.error('Failed to fetch schools:', error)
      setSchools([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingSchool) {
        // Update existing school
        const res = await fetch(`/api/schools/${editingSchool.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            plan: formData.plan,
          }),
        })

        if (res.ok) {
          await fetchSchools()
          setShowModal(false)
          resetForm()
          showToast('School updated successfully!', 'success')
        } else {
          const data = await res.json()
          showToast(`Failed to update school: ${JSON.stringify(data.error)}`, 'error')
        }
      } else {
        // Create new school
        const res = await fetch('/api/schools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        if (res.ok) {
          await fetchSchools()
          setShowModal(false)
          resetForm()
          showToast('School created successfully!', 'success')
        } else {
          const data = await res.json()
          showToast(`Failed to create school: ${JSON.stringify(data.error)}`, 'error')
        }
      }
    } catch (error) {
      console.error('Failed to save school:', error)
      showToast('Failed to save school', 'error')
    }
  }

  const handleEdit = (school: School) => {
    setEditingSchool(school)
    setFormData({
      name: school.name,
      plan: school.subscriptionPlan as 'BASIC' | 'PREMIUM' | 'ENTERPRISE',
      adminEmail: '',
      adminPassword: '',
      adminFirstName: '',
      adminLastName: '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this school?')) return
    
    try {
      const res = await fetch(`/api/schools/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchSchools()
      }
    } catch (error) {
      console.error('Failed to delete school:', error)
    }
  }

  const handleSuspensionClick = (schoolId: string, isSuspended: boolean) => {
    setSuspensionAction({ schoolId, action: isSuspended ? 'unsuspend' : 'suspend' })
    setSuspensionReason('')
    setShowSuspensionModal(true)
  }

  const handleSuspensionSubmit = async () => {
    if (!suspensionAction) return

    if (suspensionAction.action === 'suspend' && !suspensionReason.trim()) {
      showToast('Suspension reason is required', 'error')
      return
    }

    setSuspensionLoading(true)
    try {
      const res = await fetch(`/api/schools/${suspensionAction.schoolId}/suspend`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suspended: suspensionAction.action === 'suspend',
          suspensionReason: suspensionReason.trim(),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        await fetchSchools()
        setShowSuspensionModal(false)
        setSuspensionAction(null)
        setSuspensionReason('')
        showToast(data.message || 'School suspension status updated', 'success')
      } else {
        showToast(data.error || 'Failed to update school suspension status', 'error')
      }
    } catch (error) {
      console.error('Failed to update school suspension:', error)
      showToast('Failed to update school suspension status', 'error')
    } finally {
      setSuspensionLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      plan: 'BASIC',
      adminEmail: '',
      adminPassword: '',
      adminFirstName: '',
      adminLastName: '',
    })
    setEditingSchool(null)
  }

  const preferredLanguage = String(locale || session?.user?.preferredLanguage || 'en').toLowerCase()
  const t = useMemo(() => {
    const messages = preferredLanguage.startsWith('fr')
      ? frMessages
      : preferredLanguage.startsWith('sw')
        ? swMessages
        : enMessages
    return (key: string) => {
      const keys = key.split('.')
      let value: any = messages
      for (const k of keys) {
        value = value?.[k]
      }
      return value || key
    }
  }, [preferredLanguage])

  if (status === 'loading' || !session) {
    return <div>{t('common.loading')}</div>
  }

  const navItems = [
    { label: t('navigation.dashboard'), href: '/super-admin/dashboard', icon: '📊' },
    { label: t('navigation.schools'), href: '/super-admin/schools', icon: '🏢' },
    { label: t('navigation.users'), href: '/super-admin/users', icon: '👥' },
    { label: t('navigation.analytics'), href: '/super-admin/analytics', icon: '📈' },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || t('roles.super_admin'),
        role: t('roles.super_admin'),
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('school.schools.schoolsManagement')}</h1>
            <p className="text-gray-600 mt-2">{t('school.schools.subtitle')}</p>
          </div>
          <Button
            onClick={() => {
              resetForm()
              setShowModal(true)
            }}
          >
            {t('school.schools.addSchool')}
          </Button>
        </div>

        {loading ? (
          <div>{t('common.loading')}</div>
        ) : schools.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schools.map((school) => (
              <Card key={school.id} className="p-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-semibold text-gray-900">{school.name}</h3>
                    <div className="flex gap-2">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          school.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {school.active ? t('school.schools.subscriptionStatus')?.split('|')[0] || 'Active' : 'Inactive'}
                      </span>
                      {school.suspended && (
                        <span className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-800">
                          {t('school.schools.suspendSchool')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>📧 {school.email}</p>
                    <p>📞 {school.phone}</p>
                    <p>📍 {school.address}</p>
                    <p>📦 Plan: {school.subscriptionPlan}</p>
                    <p>💳 Status: {school.subscriptionStatus}</p>
                                      {school.suspended && school.suspensionReason && (
                                        <p className="text-orange-700 font-medium">Reason: {school.suspensionReason}</p>
                                      )}
                  </div>
                  <div className="flex gap-2 pt-3 flex-wrap">
                    <Button variant="secondary" onClick={() => handleEdit(school)}>
                      {t('generic.edit')}
                    </Button>
                    <Button
                      variant={school.suspended ? 'secondary' : 'danger'}
                      onClick={() => handleSuspensionClick(school.id, school.suspended)}
                    >
                      {school.suspended ? t('school.schools.unsuspendSchool') : t('school.schools.suspendSchool')}
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(school.id)}>
                      {t('generic.delete')}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-gray-500">{t('school.schools.noClasses')}</p>
          </Card>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">
                {editingSchool ? t('school.schools.editSchool') : t('school.schools.addSchool')}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label={t('school.schools.schoolName')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Select
                  label={t('school.schools.subscriptionPlan')}
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                  required
                >
                  <option value="BASIC">{t('school.schools.basic')}</option>
                  <option value="PREMIUM">{t('school.schools.premium')}</option>
                  <option value="ENTERPRISE">{t('school.schools.enterprise')}</option>
                </Select>
                
                {!editingSchool && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('school.schools.adminAccountDetails')}</h3>
                    <div className="space-y-4">
                      <Input
                        label={t('school.schools.adminFirstName')}
                        value={formData.adminFirstName}
                        onChange={(e) => setFormData({ ...formData, adminFirstName: e.target.value })}
                        required
                      />
                      <Input
                        label={t('school.schools.adminLastName')}
                        value={formData.adminLastName}
                        onChange={(e) => setFormData({ ...formData, adminLastName: e.target.value })}
                        required
                      />
                      <Input
                        label={t('school.schools.adminEmail')}
                        type="email"
                        value={formData.adminEmail}
                        onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                        required
                      />
                      <Input
                        label={t('school.schools.adminPassword')}
                        type="password"
                        value={formData.adminPassword}
                        onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                        required
                        placeholder={t('school.schools.passwordMinimum6')}
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowModal(false)
                      resetForm()
                    }}
                  >
                    {t('generic.cancel')}
                  </Button>
                  <Button type="submit">{editingSchool ? t('generic.update') : t('generic.create')}</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {showSuspensionModal && suspensionAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md p-6">
              <h2 className="text-2xl font-bold mb-4">
                {suspensionAction.action === 'suspend' ? t('school.schools.suspendSchool') : t('school.schools.unsuspendSchool')}
              </h2>
              <div className="space-y-4">
                {suspensionAction.action === 'suspend' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('school.schools.suspensionReason')}
                    </label>
                    <textarea
                      value={suspensionReason}
                      onChange={(e) => setSuspensionReason(e.target.value)}
                      placeholder={t('school.schools.enterSuspensionReason')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      required
                    />
                  </div>
                )}
                {suspensionAction.action === 'unsuspend' && (
                  <p className="text-gray-600">
                    {t('school.schools.unsuspendWarning') || 'Are you sure you want to unsuspend this school? School admins and teachers will be able to access the system again.'}
                  </p>
                )}
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowSuspensionModal(false)
                      setSuspensionAction(null)
                      setSuspensionReason('')
                    }}
                    disabled={suspensionLoading}
                  >
                    {t('generic.cancel')}
                  </Button>
                  <Button
                    type="button"
                    variant={suspensionAction.action === 'suspend' ? 'danger' : 'secondary'}
                    onClick={handleSuspensionSubmit}
                    isLoading={suspensionLoading}
                  >
                    {suspensionAction.action === 'suspend' ? t('school.schools.suspendSchool') : t('school.schools.unsuspendSchool')}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
