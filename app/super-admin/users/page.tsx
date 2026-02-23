'use client'

import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

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

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = [
    { label: 'Dashboard', href: '/super-admin/dashboard', icon: '📊' },
    { label: 'Schools', href: '/super-admin/schools', icon: '🏢' },
    { label: 'Users', href: '/super-admin/users', icon: '👥' },
    { label: 'Analytics', href: '/super-admin/analytics', icon: '📈' },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Super Admin',
        role: 'Super Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
            <p className="text-gray-600 mt-2">Manage school admins and teachers by school</p>
          </div>
          <Button onClick={openCreateModal}>Add User</Button>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">School</label>
              <Select value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)}>
                <option value="">All Schools</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">Role</label>
              <Select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                <option value="">Admins & Teachers</option>
                <option value="SCHOOL_ADMIN">School Admin</option>
                <option value="TEACHER">Teacher</option>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-6">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="p-6 text-center text-gray-600">No users found for selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">School</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
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
                        {user.role === 'SCHOOL_ADMIN' ? 'School Admin' : 'Teacher'}
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
                            Edit
                          </Button>
                          <Button variant="danger" onClick={() => handleDelete(user.id)}>
                            Delete
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
              <h2 className="text-2xl font-bold mb-4">{editingUser ? 'Edit User' : 'Add User'}</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                  <Input
                    label="Last Name"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>

                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    required
                  >
                    <option value="SCHOOL_ADMIN">School Admin</option>
                    <option value="TEACHER">Teacher</option>
                  </Select>

                  <Select
                    label="School"
                    value={formData.schoolId}
                    onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                    required
                    disabled={!!editingUser}
                  >
                    <option value="">Select School</option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <Input
                  label={editingUser ? 'Password (Optional)' : 'Password'}
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                  placeholder={editingUser ? 'Leave blank to keep current password' : 'Minimum 6 characters'}
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
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
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
