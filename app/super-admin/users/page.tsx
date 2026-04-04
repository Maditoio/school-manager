'use client'

import { useEffect, useMemo, useState } from 'react'
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
}

interface UserItem {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT' | 'SUPER_ADMIN'
  schoolId: string | null
  createdAt: string
  school?: {
    id: string
    name: string
  } | null
}

export default function SuperAdminUsersPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { locale } = useLocale()

  const [schools, setSchools] = useState<School[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [selectedSchool, setSelectedSchool] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'TEACHER',
    schoolId: '',
    password: '',
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
    if (session?.user?.role === 'SUPER_ADMIN') {
      fetchSchools()
    }
  }, [session])

  useEffect(() => {
    if (session?.user?.role === 'SUPER_ADMIN') {
      fetchUsers()
    }
  }, [session, selectedSchool, selectedRole])

  const fetchSchools = async () => {
    try {
      const res = await fetch('/api/schools')
      if (res.ok) {
        const data = await res.json()
        setSchools(Array.isArray(data.schools) ? data.schools : [])
      }
    } catch (error) {
      console.error('Failed to fetch schools:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedSchool) params.set('schoolId', selectedSchool)
      if (selectedRole) params.set('role', selectedRole)

      const res = await fetch(`/api/users?${params.toString()}`)
      if (!res.ok) {
        setUsers([])
        return
      }

      const data = await res.json()
      const list = Array.isArray(data.users) ? data.users : []
      const managed = list.filter((user: UserItem) =>
        selectedRole
          ? user.role === selectedRole
          : user.role === 'SCHOOL_ADMIN' || user.role === 'TEACHER'
      )
      setUsers(managed)
    } catch (error) {
      console.error('Failed to fetch users:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      role: 'TEACHER',
      schoolId: selectedSchool || '',
      password: '',
    })
    setEditingUser(null)
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (user: UserItem) => {
    setEditingUser(user)
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role === 'SCHOOL_ADMIN' ? 'SCHOOL_ADMIN' : 'TEACHER',
      schoolId: user.schoolId || '',
      password: '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingUser && !formData.schoolId) {
      showToast('Please select a school', 'warning')
      return
    }

    if (!editingUser && !formData.password) {
      showToast('Password is required when creating a user', 'warning')
      return
    }

    try {
      setSaving(true)

      if (editingUser) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            role: formData.role,
            ...(formData.password ? { password: formData.password } : {}),
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          showToast(data.error || 'Failed to update user', 'error')
          return
        }

        showToast('User updated successfully', 'success')
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            role: formData.role,
            schoolId: formData.schoolId,
            password: formData.password,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          showToast(data.error || 'Failed to create user', 'error')
          return
        }

        showToast('User created successfully', 'success')
      }

      setShowModal(false)
      resetForm()
      await fetchUsers()
    } catch (error) {
      console.error('Failed to save user:', error)
      showToast('Failed to save user', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to delete user', 'error')
        return
      }

      showToast('User deleted successfully', 'success')
      await fetchUsers()
    } catch (error) {
      console.error('Failed to delete user:', error)
      showToast('Failed to delete user', 'error')
    }
  }

  const schoolLookup = useMemo(() => {
    return new Map(schools.map((school) => [school.id, school.name]))
  }, [schools])

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
            <h1 className="text-3xl font-bold text-gray-900">{t('school.schools.title')}</h1>
            <p className="text-gray-600 mt-2">{t('school.schools.subtitle')}</p>
          </div>
          <Button onClick={openCreateModal}>{t('generic.add')}</Button>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">{t('school.schools.title')}</label>
              <Select value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)}>
                <option value="">{t('school.schools.title')}</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">{t('common.rolesLabel')}</label>
              <Select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                <option value="">{t('teachers.management.title')}</option>
                <option value="SCHOOL_ADMIN">{t('common.roles.school_admin')}</option>
                <option value="TEACHER">{t('common.roles.teacher')}</option>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-6">{t('common.loading')}</div>
          ) : users.length === 0 ? (
            <div className="p-6 text-center text-gray-600">{t('generic.noResults')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">{t('generic.view')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">{t('common.rolesLabel')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">{t('school.schools.title')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">{t('classes.management.createdColumn')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">{t('generic.delete')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {user.firstName} {user.lastName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">{user.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {user.role === 'SCHOOL_ADMIN' ? t('common.roles.school_admin') : t('common.roles.teacher')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {user.school?.name || (user.schoolId ? schoolLookup.get(user.schoolId) : '—') || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <Button variant="secondary" onClick={() => openEditModal(user)}>
                            {t('generic.edit')}
                          </Button>
                          <Button variant="danger" onClick={() => handleDelete(user.id)}>
                            {t('generic.delete')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">{editingUser ? t('generic.edit') : t('generic.add')} {t('teachers.management.title')}</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label={t('teachers.management.firstName')}
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                  <Input
                    label={t('teachers.management.lastName')}
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>

                <Input
                  label={t('teachers.management.email')}
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label={t('common.rolesLabel')}
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    required
                  >
                    <option value="SCHOOL_ADMIN">{t('common.roles.school_admin')}</option>
                    <option value="TEACHER">{t('common.roles.teacher')}</option>
                  </Select>

                  <Select
                    label={t('school.schools.title')}
                    value={formData.schoolId}
                    onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                    required
                    disabled={!!editingUser}
                  >
                    <option value="">{t('school.schools.title')}</option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <Input
                  label={editingUser ? `${t('teachers.management.password')} (${t('generic.optional')})` : t('teachers.management.password')}
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                  placeholder={editingUser ? t('teachers.management.placeholderPassword') : t('school.schools.passwordMinimum6')}
                />

                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowModal(false)
                      resetForm()
                    }}
                    disabled={saving}
                  >
                    {t('generic.cancel')}
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? t('common.loading') : editingUser ? t('generic.update') : t('generic.create')}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
