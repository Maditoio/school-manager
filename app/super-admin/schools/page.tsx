'use client'

import { useState, useEffect } from 'react'
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
    
    // Only support creating new schools for now (no PUT endpoint yet)
    if (editingSchool) {
      showToast('Editing schools is not yet implemented', 'warning')
      return
    }
    
    try {
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
    } catch (error) {
      console.error('Failed to save school:', error)
      showToast('Failed to save school', 'error')
    }
  }

  const handleEdit = () => {
    showToast('Editing schools is not yet implemented. Please delete and recreate if needed.', 'info')
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
            <h1 className="text-3xl font-bold text-gray-900">Schools Management</h1>
            <p className="text-gray-600 mt-2">Manage all schools in the platform</p>
          </div>
          <Button
            onClick={() => {
              resetForm()
              setShowModal(true)
            }}
          >
            Add School
          </Button>
        </div>

        {loading ? (
          <div>Loading schools...</div>
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
                        {school.active ? 'Active' : 'Inactive'}
                      </span>
                      {school.suspended && (
                        <span className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-800">
                          Suspended
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
                  <div className="flex gap-2 pt-3">
                    <Button variant="secondary" onClick={handleEdit}>
                      Edit
                                        <Button
                                          variant={school.suspended ? 'secondary' : 'danger'}
                                          onClick={() => handleSuspensionClick(school.id, school.suspended)}
                                        >
                                          {school.suspended ? 'Unsuspend' : 'Suspend'}
                                        </Button>
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(school.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-gray-500">No schools found. Click &quot;Add School&quot; to create one.</p>
          </Card>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">
                {editingSchool ? 'Edit School' : 'Add School'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="School Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Select
                  label="Subscription Plan"
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                  required
                >
                  <option value="BASIC">Basic</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </Select>
                
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Admin Account Details</h3>
                  <div className="space-y-4">
                    <Input
                      label="Admin First Name"
                      value={formData.adminFirstName}
                      onChange={(e) => setFormData({ ...formData, adminFirstName: e.target.value })}
                      required
                    />
                    <Input
                      label="Admin Last Name"
                      value={formData.adminLastName}
                      onChange={(e) => setFormData({ ...formData, adminLastName: e.target.value })}
                      required
                    />
                    <Input
                      label="Admin Email"
                      type="email"
                      value={formData.adminEmail}
                      onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                      required
                    />
                    <Input
                      label="Admin Password"
                      type="password"
                      value={formData.adminPassword}
                      onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                      required
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowModal(false)
                      resetForm()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">{editingSchool ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {showSuspensionModal && suspensionAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md p-6">
              <h2 className="text-2xl font-bold mb-4">
                {suspensionAction.action === 'suspend' ? 'Suspend School' : 'Unsuspend School'}
              </h2>
              <div className="space-y-4">
                {suspensionAction.action === 'suspend' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Suspension Reason
                    </label>
                    <textarea
                      value={suspensionReason}
                      onChange={(e) => setSuspensionReason(e.target.value)}
                      placeholder="Enter reason for suspending this school..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      required
                    />
                  </div>
                )}
                {suspensionAction.action === 'unsuspend' && (
                  <p className="text-gray-600">
                    Are you sure you want to unsuspend this school? School admins and teachers will be able to access the system again.
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
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant={suspensionAction.action === 'suspend' ? 'danger' : 'secondary'}
                    onClick={handleSuspensionSubmit}
                    isLoading={suspensionLoading}
                  >
                    {suspensionAction.action === 'suspend' ? 'Suspend' : 'Unsuspend'}
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
