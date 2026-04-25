'use client'

import { useMemo, useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, TextArea } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
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
  _count?: {
    users: number
    students: number
  }
  schoolSettings?: {
    slogan: string | null
    allowCrossSchoolCourses: boolean
    videoCoursesEnabled: boolean
  } | null
  schoolBilling?: {
    id: string
    onboardingFee: number
    onboardingStatus: 'PENDING' | 'PAID' | 'WAIVED'
    annualPricePerStudent: number
    licensedStudentCount: number
    billingYear: number
    licenseStartDate: string | null
    licenseEndDate: string | null
    enabledModules: string[]
    notes: string | null
  } | null
}

function usd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export default function SchoolsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { locale } = useLocale()
  const router = useRouter()

  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSchool, setEditingSchool] = useState<School | null>(null)
  const [activeMenuSchoolId, setActiveMenuSchoolId] = useState<string | null>(null)

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
    onboardingFee: '0',
    onboardingStatus: 'PENDING',
    annualPricePerStudent: '0',
    licensedStudentCount: '0',
    billingYear: String(new Date().getFullYear()),
    licenseStartDate: '',
    licenseEndDate: '',
    enabledModules: '',
    billingNotes: '',
    slogan: '',
    allowCrossSchoolCourses: false,
    videoCoursesEnabled: true,
  })

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') redirect('/login')
  }, [session, status])

  useEffect(() => {
    fetchSchools()
  }, [])

  async function fetchSchools() {
    try {
      const res = await fetch('/api/schools')
      if (res.ok) {
        const data = await res.json()
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

  function resetForm() {
    setFormData({
      name: '',
      plan: 'BASIC',
      adminEmail: '',
      adminPassword: '',
      adminFirstName: '',
      adminLastName: '',
      onboardingFee: '0',
      onboardingStatus: 'PENDING',
      annualPricePerStudent: '0',
      licensedStudentCount: '0',
      billingYear: String(new Date().getFullYear()),
      licenseStartDate: '',
      licenseEndDate: '',
      enabledModules: '',
      billingNotes: '',
      slogan: '',
      allowCrossSchoolCourses: false,
      videoCoursesEnabled: true,
    })
    setEditingSchool(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      if (editingSchool) {
        const res = await fetch(`/api/schools/${editingSchool.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            plan: formData.plan,
            onboardingFee: Number(formData.onboardingFee || 0),
            onboardingStatus: formData.onboardingStatus,
            annualPricePerStudent: Number(formData.annualPricePerStudent || 0),
            licensedStudentCount: Number(formData.licensedStudentCount || 0),
            billingYear: Number(formData.billingYear || new Date().getFullYear()),
            licenseStartDate: formData.licenseStartDate || null,
            licenseEndDate: formData.licenseEndDate || null,
            enabledModules: formData.enabledModules.split(',').map((item) => item.trim()).filter(Boolean),
            billingNotes: formData.billingNotes,
            slogan: formData.slogan,
            allowCrossSchoolCourses: formData.allowCrossSchoolCourses,
            videoCoursesEnabled: formData.videoCoursesEnabled,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          showToast(`Failed to update school: ${JSON.stringify(data.error)}`, 'error')
          return
        }

        showToast('School updated successfully!', 'success')
      } else {
        const res = await fetch('/api/schools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            onboardingFee: Number(formData.onboardingFee || 0),
            annualPricePerStudent: Number(formData.annualPricePerStudent || 0),
            licensedStudentCount: Number(formData.licensedStudentCount || 0),
            billingYear: Number(formData.billingYear || new Date().getFullYear()),
            enabledModules: formData.enabledModules.split(',').map((item) => item.trim()).filter(Boolean),
            allowCrossSchoolCourses: formData.allowCrossSchoolCourses,
            videoCoursesEnabled: formData.videoCoursesEnabled,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          showToast(`Failed to create school: ${JSON.stringify(data.error)}`, 'error')
          return
        }

        showToast('School created successfully!', 'success')
      }

      await fetchSchools()
      setShowModal(false)
      resetForm()
    } catch (error) {
      console.error('Failed to save school:', error)
      showToast('Failed to save school', 'error')
    }
  }

  function handleEdit(school: School) {
    setEditingSchool(school)
    setFormData({
      name: school.name,
      plan: school.subscriptionPlan as 'BASIC' | 'PREMIUM' | 'ENTERPRISE',
      adminEmail: '',
      adminPassword: '',
      adminFirstName: '',
      adminLastName: '',
      onboardingFee: String(school.schoolBilling?.onboardingFee ?? 0),
      onboardingStatus: school.schoolBilling?.onboardingStatus ?? 'PENDING',
      annualPricePerStudent: String(school.schoolBilling?.annualPricePerStudent ?? 0),
      licensedStudentCount: String(school.schoolBilling?.licensedStudentCount ?? 0),
      billingYear: String(school.schoolBilling?.billingYear ?? new Date().getFullYear()),
      licenseStartDate: school.schoolBilling?.licenseStartDate?.slice(0, 10) ?? '',
      licenseEndDate: school.schoolBilling?.licenseEndDate?.slice(0, 10) ?? '',
      enabledModules: school.schoolBilling?.enabledModules?.join(', ') ?? '',
      billingNotes: school.schoolBilling?.notes ?? '',
      slogan: school.schoolSettings?.slogan ?? '',
      allowCrossSchoolCourses: school.schoolSettings?.allowCrossSchoolCourses ?? false,
      videoCoursesEnabled: school.schoolSettings?.videoCoursesEnabled ?? true,
    })
    setShowModal(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this school?')) return

    try {
      const res = await fetch(`/api/schools/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchSchools()
        showToast('School deleted', 'success')
      } else {
        showToast('Failed to delete school', 'error')
      }
    } catch (error) {
      console.error('Failed to delete school:', error)
      showToast('Failed to delete school', 'error')
    }
  }

  function openSuspensionModal(schoolId: string, action: 'suspend' | 'unsuspend') {
    setSuspensionAction({ schoolId, action })
    setSuspensionReason('')
    setShowSuspensionModal(true)
  }

  async function handleSuspensionSubmit() {
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
      if (!res.ok) {
        showToast(data.error || 'Failed to update school suspension status', 'error')
        return
      }

      await fetchSchools()
      setShowSuspensionModal(false)
      setSuspensionAction(null)
      setSuspensionReason('')
      showToast(data.message || 'School suspension status updated', 'success')
    } catch (error) {
      console.error('Failed to update school suspension:', error)
      showToast('Failed to update school suspension status', 'error')
    } finally {
      setSuspensionLoading(false)
    }
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
      for (const k of keys) value = value?.[k]
      return value || key
    }
  }, [preferredLanguage])

  if (status === 'loading' || !session) return <div>{t('common.loading')}</div>

  const navItems = [
    { label: t('navigation.dashboard'), href: '/super-admin/dashboard', icon: '📊' },
    { label: t('navigation.schools'), href: '/super-admin/schools', icon: '🏢' },
    { label: t('navigation.users'), href: '/super-admin/users', icon: '👥' },
    { label: t('navigation.analytics'), href: '/super-admin/analytics', icon: '📈' },
    { label: 'Payments', href: '/super-admin/payments', icon: '💳' },
    { label: 'Settings', href: '/super-admin/settings', icon: '⚙️' },
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
            <h1 className="text-3xl font-bold text-gray-900">Schools</h1>
            <p className="text-gray-600 mt-2">Manage all registered schools from one table.</p>
          </div>
          <Button onClick={() => { resetForm(); setShowModal(true) }}>Add School</Button>
        </div>

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading...</div>
          ) : schools.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">No schools found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">School</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Students</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Licensed</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Fees (USD)</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Courses</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Created</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((school) => (
                    <tr key={school.id} className="border-b last:border-b-0 hover:bg-gray-50/60">
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm font-semibold text-gray-900">{school.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{school.email || 'No email'}</p>
                        {school.suspended && school.suspensionReason && (
                          <p className="text-xs text-orange-700 mt-1">Reason: {school.suspensionReason}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{school.subscriptionPlan}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`px-2 py-0.5 text-xs rounded ${school.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {school.active ? 'Active' : 'Inactive'}
                          </span>
                          {school.suspended && (
                            <span className="px-2 py-0.5 text-xs rounded bg-orange-100 text-orange-800">Suspended</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{school._count?.students ?? 0}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{school.schoolBilling?.licensedStudentCount ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        <div className="flex flex-col gap-1">
                          <span>Annual/student: {usd(school.schoolBilling?.annualPricePerStudent ?? 0)}</span>
                          <span>Onboarding: {usd(school.schoolBilling?.onboardingFee ?? 0)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 text-xs">
                          <span className={`font-medium ${school.schoolSettings?.videoCoursesEnabled !== false ? 'text-green-700' : 'text-red-700'}`}>
                            Student courses: {school.schoolSettings?.videoCoursesEnabled !== false ? 'On' : 'Off'}
                          </span>
                          <span className={`font-medium ${school.schoolSettings?.allowCrossSchoolCourses ? 'text-blue-700' : 'text-gray-500'}`}>
                            Cross-school: {school.schoolSettings?.allowCrossSchoolCourses ? 'On' : 'Off'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{new Date(school.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right relative">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 hover:bg-gray-100"
                          onClick={() => setActiveMenuSchoolId((prev) => (prev === school.id ? null : school.id))}
                        >
                          ⋮
                        </button>
                        {activeMenuSchoolId === school.id && (
                          <div className="absolute right-4 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-md z-20 text-left">
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={() => {
                                setActiveMenuSchoolId(null)
                                router.push(`/super-admin/schools/${school.id}`)
                              }}
                            >
                              View details
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={() => {
                                setActiveMenuSchoolId(null)
                                handleEdit(school)
                              }}
                            >
                              Edit school
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={() => {
                                setActiveMenuSchoolId(null)
                                openSuspensionModal(school.id, school.suspended ? 'unsuspend' : 'suspend')
                              }}
                            >
                              {school.suspended ? 'Unsuspend' : 'Suspend'} school
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setActiveMenuSchoolId(null)
                                handleDelete(school.id)
                              }}
                            >
                              Delete school
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">{editingSchool ? 'Edit School' : 'Create School'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="School Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                <Input label="School Slogan" value={formData.slogan} onChange={(e) => setFormData({ ...formData, slogan: e.target.value })} />

                <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Enable Student Video Courses</p>
                      <p className="text-xs text-gray-600 mt-0.5">Students can browse, enroll, and watch courses in this school.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.videoCoursesEnabled}
                      onClick={() => setFormData((prev) => ({ ...prev, videoCoursesEnabled: !prev.videoCoursesEnabled }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${formData.videoCoursesEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${formData.videoCoursesEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </label>
                </div>

                <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Enable Inter-School Video Courses</p>
                      <p className="text-xs text-gray-600 mt-0.5">Teachers can publish courses to students in other schools.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.allowCrossSchoolCourses}
                      onClick={() => setFormData((prev) => ({ ...prev, allowCrossSchoolCourses: !prev.allowCrossSchoolCourses }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${formData.allowCrossSchoolCourses ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${formData.allowCrossSchoolCourses ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </label>
                </div>

                <Select label="Subscription Plan" value={formData.plan} onChange={(e) => setFormData({ ...formData, plan: e.target.value })} required>
                  <option value="BASIC">Basic</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </Select>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input label="Onboarding Fee" type="number" min="0" step="0.01" value={formData.onboardingFee} onChange={(e) => setFormData({ ...formData, onboardingFee: e.target.value })} />
                  <Select
                    label="Onboarding Status"
                    value={formData.onboardingStatus}
                    onChange={(e) => setFormData({ ...formData, onboardingStatus: e.target.value })}
                    options={[
                      { value: 'PENDING', label: 'Pending' },
                      { value: 'PAID', label: 'Paid' },
                      { value: 'WAIVED', label: 'Waived' },
                    ]}
                  />
                  <Input label="Annual Price Per Student" type="number" min="0" step="0.01" value={formData.annualPricePerStudent} onChange={(e) => setFormData({ ...formData, annualPricePerStudent: e.target.value })} />
                  <Input label="Licensed Student Count" type="number" min="0" step="1" value={formData.licensedStudentCount} onChange={(e) => setFormData({ ...formData, licensedStudentCount: e.target.value })} />
                  <Input label="Billing Year" type="number" min="2000" max="2100" value={formData.billingYear} onChange={(e) => setFormData({ ...formData, billingYear: e.target.value })} />
                  <Input label="Enabled Modules" value={formData.enabledModules} onChange={(e) => setFormData({ ...formData, enabledModules: e.target.value })} placeholder="fees, attendance, assessments" />
                  <Input label="License Start Date" type="date" value={formData.licenseStartDate} onChange={(e) => setFormData({ ...formData, licenseStartDate: e.target.value })} />
                  <Input label="License End Date" type="date" value={formData.licenseEndDate} onChange={(e) => setFormData({ ...formData, licenseEndDate: e.target.value })} />
                </div>

                <TextArea label="Billing Notes" rows={3} value={formData.billingNotes} onChange={(e) => setFormData({ ...formData, billingNotes: e.target.value })} />

                {!editingSchool && (
                  <div className="border-t pt-4 mt-4 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700">Admin Account Details</h3>
                    <Input label="Admin First Name" value={formData.adminFirstName} onChange={(e) => setFormData({ ...formData, adminFirstName: e.target.value })} required />
                    <Input label="Admin Last Name" value={formData.adminLastName} onChange={(e) => setFormData({ ...formData, adminLastName: e.target.value })} required />
                    <Input label="Admin Email" type="email" value={formData.adminEmail} onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })} required />
                    <Input label="Admin Password" type="password" value={formData.adminPassword} onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })} required />
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="secondary" onClick={() => { setShowModal(false); resetForm() }}>Cancel</Button>
                  <Button type="submit">{editingSchool ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {showSuspensionModal && suspensionAction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6">
              <h2 className="text-2xl font-bold mb-4">{suspensionAction.action === 'suspend' ? 'Suspend school' : 'Unsuspend school'}</h2>
              <div className="space-y-4">
                {suspensionAction.action === 'suspend' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Suspension reason</label>
                    <textarea
                      value={suspensionReason}
                      onChange={(e) => setSuspensionReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      rows={4}
                    />
                  </div>
                ) : (
                  <p className="text-gray-600">This will restore access for this school.</p>
                )}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="secondary" onClick={() => { setShowSuspensionModal(false); setSuspensionAction(null) }}>
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
