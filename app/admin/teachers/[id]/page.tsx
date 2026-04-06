'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

type ContractRow = {
  id: string
  title: string | null
  start_date: string
  end_date: string
  status: string
  notes: string | null
}

type OffDayRow = {
  id: string
  start_date: string
  end_date: string
  reason: string | null
}

type SubjectRow = {
  class_name: string
  subject_name: string
  subject_code: string | null
}

type ProfilePayload = {
  teacher: {
    id: string
    title: string | null
    firstName: string | null
    lastName: string | null
    email: string
    phone: string | null
    createdAt: string
  }
  summary: {
    activeContract: ContractRow | null
    activeOffDay: OffDayRow | null
    totalContracts: number
    totalOffDays: number
    totalSubjects: number
    totalStudentsTaught: number
  }
  contracts: ContractRow[]
  offDays: OffDayRow[]
  subjects: SubjectRow[]
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-ZA')
}

export default function TeacherProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const [teacherId, setTeacherId] = useState('')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfilePayload | null>(null)
  const [isSavingContract, setIsSavingContract] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [contractForm, setContractForm] = useState({
    title: '',
    startDate: '',
    endDate: '',
    notes: '',
  })

  useEffect(() => {
    params.then((resolved) => setTeacherId(resolved.id))
  }, [params])

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN' && session?.user?.role !== 'DEPUTY_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  const loadProfile = useCallback(async () => {
    if (!teacherId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/teachers/${teacherId}/profile`, { cache: 'no-store' })
      if (!response.ok) {
        setProfile(null)
        return
      }

      const payload = await response.json()
      setProfile(payload)
    } catch (error) {
      console.error('Failed to load teacher profile:', error)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [teacherId])

  useEffect(() => {
    if (!session || !teacherId) return
    loadProfile()
  }, [session, teacherId, loadProfile])

  const handleCreateContract = async (e: FormEvent) => {
    e.preventDefault()
    if (!teacherId) return

    if (!contractForm.startDate || !contractForm.endDate) {
      showToast('Contract start and end dates are required', 'error')
      return
    }

    setIsSavingContract(true)
    try {
      const response = await fetch('/api/teacher-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId,
          title: contractForm.title.trim() || undefined,
          startDate: contractForm.startDate,
          endDate: contractForm.endDate,
          status: 'ACTIVE',
          notes: contractForm.notes.trim() || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        showToast(data?.error || 'Failed to save contract', 'error')
        return
      }

      showToast('Contract saved successfully', 'success')
      setShowContractModal(false)
      setContractForm({ title: '', startDate: '', endDate: '', notes: '' })
      await loadProfile()
    } catch (error) {
      console.error('Failed to save contract:', error)
      showToast('Failed to save contract', 'error')
    } finally {
      setIsSavingContract(false)
    }
  }

  const navItems = session?.user?.role === 'DEPUTY_ADMIN' ? [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { label: 'Students', href: '/admin/students', icon: '👨‍🎓' },
    { label: 'Teachers', href: '/admin/teachers', icon: '👨‍🏫' },
    { label: 'Classes', href: '/admin/classes', icon: '🏫' },
    { label: 'Subjects', href: '/admin/subjects', icon: '📚' },
    { label: 'Results', href: '/admin/results', icon: '📝' },
    { label: 'Fees', href: '/admin/fees', icon: '💳' },
    { label: 'Announcements', href: '/admin/announcements', icon: '📢' },
    { label: 'Messages', href: '/admin/messages', icon: '💬' },
    { label: 'Interaction Logs', href: '/admin/interaction-logs', icon: '🕵️' },
  ] : [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { label: 'Students', href: '/admin/students', icon: '👨‍🎓' },
    { label: 'Teachers', href: '/admin/teachers', icon: '👨‍🏫' },
    { label: 'Classes', href: '/admin/classes', icon: '🏫' },
    { label: 'Subjects', href: '/admin/subjects', icon: '📚' },
    { label: 'Attendance', href: '/admin/attendance', icon: '📅' },
    { label: 'Results', href: '/admin/results', icon: '📝' },
    { label: 'Fees', href: '/admin/fees', icon: '💳' },
    { label: 'Announcements', href: '/admin/announcements', icon: '📢' },
    { label: 'Messages', href: '/admin/messages', icon: '💬' },
    { label: 'Interaction Logs', href: '/admin/interaction-logs', icon: '🕵️' },
  ]

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const fullName = profile
    ? `${profile.teacher.title ? `${profile.teacher.title} ` : ''}${profile.teacher.firstName || ''} ${profile.teacher.lastName || ''}`.trim()
    : 'Teacher Profile'

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session?.user?.role === 'DEPUTY_ADMIN' ? 'Deputy Admin' : 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6 teacher-profile-no-table-hover">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{fullName}</h1>
            <p className="text-gray-600 mt-2">Teacher profile and teaching overview</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowContractModal(true)}
              disabled={loading || !profile}
            >
              Add Contract
            </Button>
            <a href="/admin/teachers" className="ui-button ui-button-secondary h-8 px-3.5 text-[13px] inline-flex items-center justify-center">
              Back to Teachers
            </a>
          </div>
        </div>

        {loading ? (
          <Card className="p-6">Loading teacher profile...</Card>
        ) : !profile ? (
          <Card className="p-6">Teacher profile not found.</Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-xs ui-text-secondary">Students Taught</p>
                <p className="text-2xl font-semibold ui-text-primary">{profile.summary.totalStudentsTaught}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs ui-text-secondary">Subjects Assigned</p>
                <p className="text-2xl font-semibold ui-text-primary">{profile.summary.totalSubjects}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs ui-text-secondary">Contracts</p>
                <p className="text-2xl font-semibold ui-text-primary">{profile.summary.totalContracts}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs ui-text-secondary">Off-Day Records</p>
                <p className="text-2xl font-semibold ui-text-primary">{profile.summary.totalOffDays}</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5 space-y-2">
                <h2 className="text-lg font-semibold ui-text-primary">Teacher Information</h2>
                <p className="text-sm ui-text-secondary">Email: {profile.teacher.email}</p>
                <p className="text-sm ui-text-secondary">Phone: {profile.teacher.phone || 'N/A'}</p>
                <p className="text-sm ui-text-secondary">Joined: {formatDate(profile.teacher.createdAt)}</p>
              </Card>

              <Card className="p-5 space-y-2">
                <h2 className="text-lg font-semibold ui-text-primary">Current Status</h2>
                <p className="text-sm ui-text-secondary">
                  Availability: {profile.summary.activeOffDay ? 'Away' : 'Available'}
                </p>
                <p className="text-sm ui-text-secondary">
                  Contract: {profile.summary.activeContract ? `${profile.summary.activeContract.status} (ends ${formatDate(profile.summary.activeContract.end_date)})` : 'No active contract'}
                </p>
                <p className="text-sm ui-text-secondary">
                  Off-Day: {profile.summary.activeOffDay ? `Active (${formatDate(profile.summary.activeOffDay.start_date)} - ${formatDate(profile.summary.activeOffDay.end_date)})` : 'Not on off-day'}
                </p>
              </Card>
            </div>

            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b border-(--border-subtle)">
                <h2 className="text-lg font-semibold ui-text-primary">Subjects & Classes</h2>
              </div>
              {profile.subjects.length === 0 ? (
                <div className="p-4 ui-text-secondary">No subject assignments found.</div>
              ) : (
                <div className="overflow-x-auto ui-table-wrap">
                  <table className="ui-table min-w-full no-table-hover">
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>Subject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.subjects.map((row, index) => (
                        <tr key={`${row.class_name}-${row.subject_name}-${index}`}>
                          <td>{row.class_name}</td>
                          <td>{row.subject_code ? `${row.subject_code} - ${row.subject_name}` : row.subject_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-0 overflow-hidden">
                <div className="p-4 border-b border-(--border-subtle)">
                  <h2 className="text-lg font-semibold ui-text-primary">Contract History</h2>
                </div>
                {profile.contracts.length === 0 ? (
                  <div className="p-4 ui-text-secondary">No contracts recorded.</div>
                ) : (
                  <div className="overflow-x-auto ui-table-wrap">
                    <table className="ui-table min-w-full no-table-hover">
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.contracts.map((contract) => (
                          <tr key={contract.id}>
                            <td>{formatDate(contract.start_date)} - {formatDate(contract.end_date)}</td>
                            <td>{contract.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card className="p-0 overflow-hidden">
                <div className="p-4 border-b border-(--border-subtle)">
                  <h2 className="text-lg font-semibold ui-text-primary">Off-Day History</h2>
                </div>
                {profile.offDays.length === 0 ? (
                  <div className="p-4 ui-text-secondary">No off-day records found.</div>
                ) : (
                  <div className="overflow-x-auto ui-table-wrap">
                    <table className="ui-table min-w-full no-table-hover">
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.offDays.map((row) => (
                          <tr key={row.id}>
                            <td>{formatDate(row.start_date)} - {formatDate(row.end_date)}</td>
                            <td>{row.reason || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </>
        )}

        {showContractModal ? (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
            <Card className="w-[min(92vw,30rem)] max-w-none p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-2">Store New Contract</h2>
              <p className="text-sm text-gray-600 mb-4">Saved contracts appear in Contract History.</p>

              <form onSubmit={handleCreateContract} className="space-y-4">
                <Input
                  label="Contract Title"
                  value={contractForm.title}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Annual teaching contract"
                />

                <Input
                  label="Start Date"
                  type="date"
                  value={contractForm.startDate}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  required
                />

                <Input
                  label="End Date"
                  type="date"
                  value={contractForm.endDate}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  required
                />

                <label className="block text-sm font-medium ui-text-primary">
                  Notes (optional)
                  <textarea
                    value={contractForm.notes}
                    onChange={(e) => setContractForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="ui-input mt-1 min-h-24"
                    placeholder="Add contract notes"
                  />
                </label>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowContractModal(false)
                      setContractForm({ title: '', startDate: '', endDate: '', notes: '' })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={isSavingContract}>Save Contract</Button>
                </div>
              </form>
            </Card>
          </div>
        ) : null}
        <style jsx global>{`
          .teacher-profile-no-table-hover .ui-table thead,
          .teacher-profile-no-table-hover table.no-table-hover thead {
            background: var(--surface-soft) !important;
          }

          .teacher-profile-no-table-hover .ui-table th,
          .teacher-profile-no-table-hover table.no-table-hover th {
            color: var(--text-secondary) !important;
          }

          .teacher-profile-no-table-hover .ui-table tbody tr:nth-child(odd),
          .teacher-profile-no-table-hover table.no-table-hover tbody tr:nth-child(odd) {
            background: var(--surface) !important;
          }

          .teacher-profile-no-table-hover .ui-table tbody tr:nth-child(even),
          .teacher-profile-no-table-hover table.no-table-hover tbody tr:nth-child(even) {
            background: var(--surface-soft) !important;
          }

          .teacher-profile-no-table-hover .ui-table tbody tr:nth-child(odd):hover,
          .teacher-profile-no-table-hover .ui-table tbody tr:nth-child(even):hover,
          .teacher-profile-no-table-hover table.no-table-hover tbody tr:nth-child(odd):hover,
          .teacher-profile-no-table-hover table.no-table-hover tbody tr:nth-child(even):hover {
            background: inherit !important;
          }

          .teacher-profile-no-table-hover .ui-table td,
          .teacher-profile-no-table-hover .ui-table tbody tr:hover td,
          .teacher-profile-no-table-hover table.no-table-hover td,
          .teacher-profile-no-table-hover table.no-table-hover tbody tr:hover td {
            color: var(--text-primary) !important;
          }

          .teacher-profile-no-table-hover .ui-table a,
          .teacher-profile-no-table-hover .ui-table a:hover,
          .teacher-profile-no-table-hover table.no-table-hover a,
          .teacher-profile-no-table-hover table.no-table-hover a:hover {
            color: var(--text-primary) !important;
            text-decoration: none !important;
          }
        `}</style>
      </div>
    </DashboardLayout>
  )
}
