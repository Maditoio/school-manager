'use client'

import { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, TextArea } from '@/components/ui/Form'
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
    payments?: Array<{
      id: string
      amount: number
      paymentType: 'ONBOARDING' | 'ANNUAL' | 'ADJUSTMENT'
      paymentDate: string
    }>
  } | null
}

interface LedgerPayment {
  id: string
  amount: number
  paymentType: 'ONBOARDING' | 'ANNUAL' | 'ADJUSTMENT'
  paymentDate: string
  paymentMethod: string | null
  referenceNumber: string | null
  notes: string | null
  recordedBy: { id: string; firstName: string | null; lastName: string | null; email: string } | null
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

  // Ledger state
  const [showLedgerModal, setShowLedgerModal] = useState(false)
  const [ledgerSchool, setLedgerSchool] = useState<School | null>(null)
  const [ledgerPayments, setLedgerPayments] = useState<LedgerPayment[]>([])
  const [ledgerTotalPaid, setLedgerTotalPaid] = useState(0)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerOnboardingStatus, setLedgerOnboardingStatus] = useState<'PENDING' | 'PAID' | 'WAIVED'>('PENDING')
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentType: 'ANNUAL',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: '',
    referenceNumber: '',
    notes: '',
  })
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
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
            onboardingFee: Number(formData.onboardingFee || 0),
            onboardingStatus: formData.onboardingStatus,
            annualPricePerStudent: Number(formData.annualPricePerStudent || 0),
            licensedStudentCount: Number(formData.licensedStudentCount || 0),
            billingYear: Number(formData.billingYear || new Date().getFullYear()),
            licenseStartDate: formData.licenseStartDate || null,
            licenseEndDate: formData.licenseEndDate || null,
            enabledModules: formData.enabledModules.split(',').map((item) => item.trim()).filter(Boolean),
            billingNotes: formData.billingNotes,
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
          body: JSON.stringify({
            ...formData,
            onboardingFee: Number(formData.onboardingFee || 0),
            annualPricePerStudent: Number(formData.annualPricePerStudent || 0),
            licensedStudentCount: Number(formData.licensedStudentCount || 0),
            billingYear: Number(formData.billingYear || new Date().getFullYear()),
            enabledModules: formData.enabledModules.split(',').map((item) => item.trim()).filter(Boolean),
          }),
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
      onboardingFee: String(school.schoolBilling?.onboardingFee ?? 0),
      onboardingStatus: school.schoolBilling?.onboardingStatus ?? 'PENDING',
      annualPricePerStudent: String(school.schoolBilling?.annualPricePerStudent ?? 0),
      licensedStudentCount: String(school.schoolBilling?.licensedStudentCount ?? 0),
      billingYear: String(school.schoolBilling?.billingYear ?? new Date().getFullYear()),
      licenseStartDate: school.schoolBilling?.licenseStartDate?.slice(0, 10) ?? '',
      licenseEndDate: school.schoolBilling?.licenseEndDate?.slice(0, 10) ?? '',
      enabledModules: school.schoolBilling?.enabledModules?.join(', ') ?? '',
      billingNotes: school.schoolBilling?.notes ?? '',
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

  const openLedger = async (school: School) => {
    setLedgerSchool(school)
    setLedgerPayments([])
    setLedgerTotalPaid(0)
    setLedgerOnboardingStatus(school.schoolBilling?.onboardingStatus ?? 'PENDING')
    setShowLedgerModal(true)
    setLedgerLoading(true)
    setPaymentForm({
      amount: '',
      paymentType: 'ANNUAL',
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: '',
      referenceNumber: '',
      notes: '',
    })
    try {
      const res = await fetch(`/api/schools/${school.id}/billing-payments`)
      if (res.ok) {
        const data = await res.json()
        setLedgerPayments(Array.isArray(data.payments) ? data.payments : [])
        setLedgerTotalPaid(Number(data.totalPaid) || 0)
        // Reflect reconciled status returned from server
        if (data.onboardingStatus) setLedgerOnboardingStatus(data.onboardingStatus)
      }
    } catch (error) {
      console.error('Failed to fetch billing payments:', error)
    } finally {
      setLedgerLoading(false)
    }
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ledgerSchool) return
    setPaymentSubmitting(true)
    try {
      const res = await fetch(`/api/schools/${ledgerSchool.id}/billing-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(paymentForm.amount),
          paymentType: paymentForm.paymentType,
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod || undefined,
          referenceNumber: paymentForm.referenceNumber || undefined,
          notes: paymentForm.notes || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setLedgerPayments((prev) => [data.payment, ...prev])
        setLedgerTotalPaid((prev) => prev + data.payment.amount)
        if (data.onboardingStatus) setLedgerOnboardingStatus(data.onboardingStatus)
        setPaymentForm({
          amount: '',
          paymentType: 'ANNUAL',
          paymentDate: new Date().toISOString().slice(0, 10),
          paymentMethod: '',
          referenceNumber: '',
          notes: '',
        })
        showToast('Payment recorded successfully', 'success')
      } else {
        const data = await res.json()
        showToast(`Error: ${JSON.stringify(data.error)}`, 'error')
      }
    } catch (error) {
      console.error('Failed to record payment:', error)
      showToast('Failed to record payment', 'error')
    } finally {
      setPaymentSubmitting(false)
    }
  }

  const handleDeletePayment = async (paymentId: string, amount: number) => {
    if (!ledgerSchool || !confirm('Delete this payment record?')) return
    try {
      const res = await fetch(`/api/schools/${ledgerSchool.id}/billing-payments/${paymentId}`, { method: 'DELETE' })
      if (res.ok) {
        setLedgerPayments((prev) => prev.filter((p) => p.id !== paymentId))
        setLedgerTotalPaid((prev) => prev - amount)
        showToast('Payment deleted', 'success')
      } else {
        showToast('Failed to delete payment', 'error')
      }
    } catch (error) {
      console.error('Failed to delete payment:', error)
      showToast(`Failed to delete payment: ${error}`, 'error')
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
      onboardingFee: '0',
      onboardingStatus: 'PENDING',
      annualPricePerStudent: '0',
      licensedStudentCount: '0',
      billingYear: String(new Date().getFullYear()),
      licenseStartDate: '',
      licenseEndDate: '',
      enabledModules: '',
      billingNotes: '',
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
                    <p>👥 Licensed Students: {school.schoolBilling?.licensedStudentCount ?? 0}</p>
                    <p>💰 Annual / Student: {school.schoolBilling?.annualPricePerStudent ?? 0}</p>
                    <p>🧭 Onboarding: {school.schoolBilling?.onboardingStatus ?? 'PENDING'}</p>
                                      {school.suspended && school.suspensionReason && (
                                        <p className="text-orange-700 font-medium">Reason: {school.suspensionReason}</p>
                                      )}
                  </div>
                  <div className="flex gap-2 pt-3 flex-wrap">
                    <Button variant="secondary" onClick={() => handleEdit(school)}>
                      {t('generic.edit')}
                    </Button>
                    <Button variant="secondary" onClick={() => openLedger(school)}>
                      Ledger
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input
                    label="Onboarding Fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.onboardingFee}
                    onChange={(e) => setFormData({ ...formData, onboardingFee: e.target.value })}
                  />
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
                  <Input
                    label="Annual Price Per Student"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.annualPricePerStudent}
                    onChange={(e) => setFormData({ ...formData, annualPricePerStudent: e.target.value })}
                  />
                  <Input
                    label="Licensed Student Count"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.licensedStudentCount}
                    onChange={(e) => setFormData({ ...formData, licensedStudentCount: e.target.value })}
                  />
                  <Input
                    label="Billing Year"
                    type="number"
                    min="2000"
                    max="2100"
                    value={formData.billingYear}
                    onChange={(e) => setFormData({ ...formData, billingYear: e.target.value })}
                  />
                  <Input
                    label="Enabled Modules"
                    value={formData.enabledModules}
                    onChange={(e) => setFormData({ ...formData, enabledModules: e.target.value })}
                    placeholder="fees, attendance, assessments"
                  />
                  <Input
                    label="License Start Date"
                    type="date"
                    value={formData.licenseStartDate}
                    onChange={(e) => setFormData({ ...formData, licenseStartDate: e.target.value })}
                  />
                  <Input
                    label="License End Date"
                    type="date"
                    value={formData.licenseEndDate}
                    onChange={(e) => setFormData({ ...formData, licenseEndDate: e.target.value })}
                  />
                </div>
                <TextArea
                  label="Billing Notes"
                  rows={3}
                  value={formData.billingNotes}
                  onChange={(e) => setFormData({ ...formData, billingNotes: e.target.value })}
                />
                
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

        {showLedgerModal && ledgerSchool && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-3xl p-6 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold">Billing Ledger</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{ledgerSchool.name}</p>
                </div>
                <Button variant="secondary" onClick={() => setShowLedgerModal(false)}>Close</Button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Onboarding Fee</p>
                  <p className="text-lg font-bold text-blue-800 mt-1">
                    {(ledgerSchool.schoolBilling?.onboardingFee ?? 0).toLocaleString()}
                  </p>
                  <p className={`text-xs mt-0.5 font-medium ${
                    ledgerOnboardingStatus === 'PAID' ? 'text-green-600' :
                    ledgerOnboardingStatus === 'WAIVED' ? 'text-purple-600' : 'text-amber-600'
                  }`}>
                    {ledgerOnboardingStatus}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Total Paid</p>
                  <p className="text-lg font-bold text-green-800 mt-1">{ledgerTotalPaid.toLocaleString()}</p>
                  <p className="text-xs mt-0.5 text-green-600">{ledgerPayments.length} payments</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Annual Due</p>
                  <p className="text-lg font-bold text-amber-800 mt-1">
                    {((ledgerSchool.schoolBilling?.annualPricePerStudent ?? 0) * (ledgerSchool.schoolBilling?.licensedStudentCount ?? 0)).toLocaleString()}
                  </p>
                  <p className="text-xs mt-0.5 text-amber-600">
                    {ledgerSchool.schoolBilling?.licensedStudentCount ?? 0} licensed × {ledgerSchool.schoolBilling?.annualPricePerStudent ?? 0}/student
                  </p>
                </div>
              </div>

              {/* Add Payment Form */}
              <div className="border rounded-lg p-4 mb-6 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Record New Payment</h3>
                <form onSubmit={handleAddPayment} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      required
                    />
                    <Select
                      label="Payment Type"
                      value={paymentForm.paymentType}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value })}
                      options={[
                        { value: 'ONBOARDING', label: 'Onboarding Fee' },
                        { value: 'ANNUAL', label: 'Annual License' },
                        { value: 'ADJUSTMENT', label: 'Adjustment / Credit' },
                      ]}
                    />
                    <Input
                      label="Payment Date"
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                      required
                    />
                    <Input
                      label="Payment Method"
                      value={paymentForm.paymentMethod}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                      placeholder="EFT, Cash, Card..."
                    />
                    <Input
                      label="Reference Number"
                      value={paymentForm.referenceNumber}
                      onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                      placeholder="Invoice / transaction ref"
                    />
                  </div>
                  <Input
                    label="Notes"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    placeholder="Optional notes..."
                  />
                  <div className="flex justify-end">
                    <Button type="submit" isLoading={paymentSubmitting}>
                      Record Payment
                    </Button>
                  </div>
                </form>
              </div>

              {/* Payment History */}
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment History</h3>
              {ledgerLoading ? (
                <p className="text-sm text-gray-500">Loading payments...</p>
              ) : ledgerPayments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No payments recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {ledgerPayments.map((payment) => (
                    <div key={payment.id} className="flex items-start justify-between rounded-lg border p-3 bg-white">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            payment.paymentType === 'ONBOARDING' ? 'bg-blue-100 text-blue-700' :
                            payment.paymentType === 'ANNUAL' ? 'bg-green-100 text-green-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {payment.paymentType}
                          </span>
                          <span className="text-sm font-semibold text-gray-800">
                            {Number(payment.amount).toLocaleString()}
                          </span>
                          {payment.referenceNumber && (
                            <span className="text-xs text-gray-400">#{payment.referenceNumber}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(payment.paymentDate).toLocaleDateString()}
                          {payment.paymentMethod && ` · ${payment.paymentMethod}`}
                          {payment.recordedBy && ` · Recorded by ${payment.recordedBy.firstName ?? ''} ${payment.recordedBy.lastName ?? ''}`.trimEnd()}
                        </p>
                        {payment.notes && <p className="text-xs text-gray-400 italic">{payment.notes}</p>}
                      </div>
                      <button
                        onClick={() => handleDeletePayment(payment.id, payment.amount)}
                        className="ml-3 text-xs text-red-400 hover:text-red-600 shrink-0"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
