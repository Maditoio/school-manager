'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import { Input, Select } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { translateText } from '@/lib/client-i18n'
import { useLocale } from '@/lib/locale-context'
import { UserPlus } from 'lucide-react'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'

type UserRole = 'TEACHER' | 'PARENT' | 'FINANCE' | 'FINANCE_MANAGER'

type UserItem = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  createdAt: string
}

type RoleFilter = '' | UserRole

const ROLE_OPTIONS: Array<{ value: UserRole; labelKey: string }> = [
  { value: 'TEACHER', labelKey: 'Teacher' },
  { value: 'PARENT', labelKey: 'Parent' },
  { value: 'FINANCE', labelKey: 'Finance' },
  { value: 'FINANCE_MANAGER', labelKey: 'Finance Manager' },
]

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { locale } = useLocale()

  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [tablePage, setTablePage] = useState(1)
  const pageSize = 20

  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'TEACHER' as UserRole,
  })

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && session.user.role !== 'SCHOOL_ADMIN' && session.user.role !== 'DEPUTY_ADMIN') redirect('/login')
  }, [session, status])

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (roleFilter) params.set('role', roleFilter)
      const res = await fetch(`/api/users?${params}`)
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || translateText('Failed to load users', locale), 'error')
        return
      }
      const filtered = (Array.isArray(data.users) ? data.users : []).filter(
        (u: { role: string }) => u.role !== 'SCHOOL_ADMIN' && u.role !== 'SUPER_ADMIN' && u.role !== 'DEPUTY_ADMIN'
      ) as UserItem[]
      setUsers(filtered)
    } catch {
      showToast(translateText('Failed to load users', locale), 'error')
    } finally {
      setLoading(false)
    }
  }, [roleFilter, locale])

  useEffect(() => {
    if (session?.user?.role === 'SCHOOL_ADMIN' || session?.user?.role === 'DEPUTY_ADMIN') fetchUsers()
  }, [session?.user?.role, fetchUsers])

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase()
      return fullName.includes(q) || u.email.toLowerCase().includes(q)
    })
  }, [users, searchQuery])

  const currentPageRows = useMemo(() => {
    const start = (tablePage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, tablePage])

  const resetForm = () => {
    setFormData({ firstName: '', lastName: '', email: '', password: '', role: 'TEACHER' })
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedPassword = formData.password.trim()
    if (!trimmedPassword) {
      showToast(translateText('Password is required', locale), 'warning')
      return
    }
    if (trimmedPassword.length < 6) {
      showToast(translateText('Password must be at least 6 characters', locale), 'warning')
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, password: trimmedPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = Array.isArray(data.error) && data.error[0]?.message
          ? String(data.error[0].message)
          : typeof data.error === 'string' ? data.error : translateText('Failed to save user', locale)
        showToast(msg, 'error')
        return
      }
      showToast(translateText('User created successfully', locale), 'success')
      setShowModal(false)
      resetForm()
      await fetchUsers()
    } catch {
      showToast(translateText('Failed to save user', locale), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm(translateText('Are you sure you want to delete this user?', locale))) return
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || translateText('Failed to delete user', locale), 'error')
        return
      }
      showToast(translateText('User deleted successfully', locale), 'success')
      await fetchUsers()
    } catch {
      showToast(translateText('Failed to delete user', locale), 'error')
    }
  }

  const handleResetPassword = async (user: UserItem) => {
    const newPassword = prompt(
      translateText('Enter a temporary password (min 6 characters):', locale)
    )
    if (!newPassword) return
    if (newPassword.length < 6) {
      showToast(translateText('Password must be at least 6 characters', locale), 'error')
      return
    }
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || translateText('Failed to reset password', locale), 'error')
        return
      }
      showToast(translateText('Password reset. User must change it on first login.', locale), 'success')
    } catch {
      showToast(translateText('Failed to reset password', locale), 'error')
    }
  }

  const roleLabel = (role: UserRole) => {
    if (role === 'FINANCE') return translateText('Finance', locale)
    if (role === 'FINANCE_MANAGER') return translateText('Finance Manager', locale)
    if (role === 'PARENT') return translateText('Parent', locale)
    return translateText('Teacher', locale)
  }

  const columns = useMemo(() => [
    {
      key: 'name',
      label: translateText('Name', locale),
      sortable: true,
      renderCell: (u: UserItem) => (
        <div className="flex flex-col">
          <span className="font-medium ui-text-primary">
            {`${u.firstName || ''} ${u.lastName || ''}`.trim() || '—'}
          </span>
          <span className="text-xs ui-text-secondary">{u.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      label: translateText('Role', locale),
      sortable: true,
      renderCell: (u: UserItem) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          u.role === 'FINANCE'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
            : u.role === 'FINANCE_MANAGER'
              ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300'
              : u.role === 'PARENT'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
        }`}>
          {roleLabel(u.role)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: translateText('Joined', locale),
      sortable: true,
      renderCell: (u: UserItem) => new Date(u.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: translateText('Actions', locale),
      renderCell: (u: UserItem) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleResetPassword(u)}
            className="text-indigo-400 hover:underline text-sm"
          >
            {translateText('Reset Password', locale)}
          </button>
          <button
            type="button"
            onClick={() => handleDelete(u.id)}
            className="text-rose-400 hover:underline text-sm"
          >
            {translateText('Delete', locale)}
          </button>
        </div>
      ),
    },
  ], [locale])

  const navItems = session?.user?.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS

  if (status === 'loading' || !session?.user) return <div>Loading...</div>

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session?.user?.role === 'DEPUTY_ADMIN' ? 'Deputy Admin' : 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold ui-text-primary">
              {translateText('User Management', locale)}
            </h1>
            <p className="mt-1 ui-text-secondary">
              {translateText('Add and manage teachers, parents, and finance users for your school.', locale)}
            </p>
          </div>
          <Button onClick={openCreateModal} className="inline-flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {translateText('Add User', locale)}
          </Button>
        </div>

        {/* Filters */}
        <Card title={translateText('Filters', locale)} className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              label={translateText('Role', locale)}
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value as RoleFilter); setTablePage(1) }}
            >
              <option value="">{translateText('All roles', locale)}</option>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{translateText(o.labelKey, locale)}</option>
              ))}
            </Select>
            <Input
              label={translateText('Search', locale)}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setTablePage(1) }}
              placeholder={translateText('Search by name or email...', locale)}
            />
          </div>
        </Card>

        {/* Table */}
        <Table
          title={translateText('Users', locale)}
          columns={columns}
          data={currentPageRows}
          loading={loading}
          totalCount={filteredUsers.length}
          page={tablePage}
          pageSize={pageSize}
          onPageChange={setTablePage}
          emptyMessage={translateText('No users found.', locale)}
          rowKey="id"
        />
      </div>

      {/* Create User Modal */}
      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
          <Card
            title={translateText('Add User', locale)}
            className="w-full max-w-lg p-6"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label={translateText('First Name', locale)}
                  value={formData.firstName}
                  onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                  required
                />
                <Input
                  label={translateText('Last Name', locale)}
                  value={formData.lastName}
                  onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                  required
                />
              </div>
              <Input
                label={translateText('Email', locale)}
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                required
              />
              <Input
                label={translateText('Password', locale)}
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                placeholder={translateText('Minimum 6 characters', locale)}
                required
              />
              <Select
                label={translateText('Role', locale)}
                value={formData.role}
                onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value as UserRole }))}
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{translateText(o.labelKey, locale)}</option>
                ))}
              </Select>
              <p className="text-xs ui-text-secondary">
                {translateText('The user will be required to change their password on first login.', locale)}
              </p>
              <div className="flex gap-2 pt-1">
                <Button type="submit" isLoading={saving} className="flex-1">
                  {translateText('Create User', locale)}
                </Button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm() }}
                  className="flex-1 ui-button ui-button-secondary"
                >
                  {translateText('Cancel', locale)}
                </button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </DashboardLayout>
  )
}
