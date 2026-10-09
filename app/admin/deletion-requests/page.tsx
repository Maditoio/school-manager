'use client'

import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { format } from 'date-fns'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import { useAdminUi } from '@/lib/use-admin-ui'

interface DeletionRequest {
  id: string
  resourceType: string
  resourceId: string
  resourceName: string
  reason?: string
  status: string
  scheduledFor: string
  createdAt: string
  requestor: {
    id: string
    firstName?: string
    lastName?: string
    email: string
  }
  approver?: {
    id: string
    firstName?: string
    lastName?: string
    email: string
  }
}

export default function DeletionRequestsPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { tAdmin, tCommon } = useAdminUi()
  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)
  const [executing, setExecuting] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<'PENDING' | 'APPROVED' | 'EXECUTED' | 'CANCELLED'>('PENDING')

  const tabLabel = (tab: 'PENDING' | 'APPROVED' | 'EXECUTED' | 'CANCELLED') => {
    if (tab === 'PENDING') return tAdmin('pendingTab', 'Pending')
    if (tab === 'APPROVED') return tAdmin('approvedTab', 'Approved')
    if (tab === 'EXECUTED') return tAdmin('executedTab', 'Executed')
    return tAdmin('cancelledTab', 'Cancelled')
  }

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/deletion-requests?status=${selectedTab}`)
      const data = await res.json()
      setRequests(data.deletionRequests || [])
    } catch (error) {
      console.error('Failed to fetch deletion requests:', error)
      showToast(tAdmin('failedLoadDeletionRequests', 'Failed to load deletion requests'), 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedTab, showToast, tAdmin])

  useEffect(() => {
    if (session?.user) {
      fetchRequests()
    }
  }, [fetchRequests, session])

  if (status === 'loading') return <div>{tCommon('loading', 'Loading...')}</div>
  if (!session?.user) redirect('/signin')

  const handleApprove = async (id: string) => {
    if (!confirm(tAdmin('confirmApproveDeletion', 'Approve this deletion request?'))) {
      return
    }

    try {
      setApproving(id)
      const res = await fetch(`/api/deletion-requests/${id}/approve`, {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        showToast(tAdmin('deletionApproved', 'Deletion request approved'), 'success')
        await fetchRequests()
      } else {
        showToast(data.error || tAdmin('failedApproveDeletion', 'Failed to approve deletion request'), 'error')
      }
    } catch (error) {
      console.error('Failed to approve:', error)
      showToast(tAdmin('failedApproveDeletion', 'Failed to approve deletion request'), 'error')
    } finally {
      setApproving(null)
    }
  }

  const handleExecute = async (id: string) => {
    if (
      !confirm(
        tAdmin('confirmExecuteDeletion', 'Execute this deletion now? This cannot be undone.')
      )
    ) {
      return
    }

    try {
      setExecuting(id)
      const res = await fetch(`/api/deletion-requests/${id}/execute`, {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        showToast(tAdmin('deletionExecuted', 'Deletion executed'), 'success')
        await fetchRequests()
      } else {
        showToast(data.error || tAdmin('failedExecuteDeletion', 'Failed to execute deletion'), 'error')
      }
    } catch (error) {
      console.error('Failed to execute:', error)
      showToast(tAdmin('failedExecuteDeletion', 'Failed to execute deletion'), 'error')
    } finally {
      setExecuting(null)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm(tAdmin('confirmCancelDeletion', 'Cancel this deletion request?'))) {
      return
    }

    try {
      setCancelling(id)
      const res = await fetch(`/api/deletion-requests/${id}/cancel`, {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        showToast(tAdmin('deletionCancelled', 'Deletion request cancelled'), 'success')
        await fetchRequests()
      } else {
        showToast(data.error || tAdmin('failedCancelDeletion', 'Failed to cancel deletion request'), 'error')
      }
    } catch (error) {
      console.error('Failed to cancel:', error)
      showToast(tAdmin('failedCancelDeletion', 'Failed to cancel deletion request'), 'error')
    } finally {
      setCancelling(null)
    }
  }

  const tabs: Array<'PENDING' | 'APPROVED' | 'EXECUTED' | 'CANCELLED'> = ['PENDING', 'APPROVED', 'EXECUTED', 'CANCELLED']

  if (!session) {
    return <div>{tCommon('loading', 'Loading...')}</div>
  }

  const navItems = session?.user?.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS
  const statusLabel = tabLabel(selectedTab)

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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{tAdmin('deletionRequestsTitle', 'Deletion Requests')}</h1>
          <p className="text-sm text-gray-600">
            {tAdmin('deletionRequestsHelp', 'Manage critical resource deletions with 2-admin approval')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-2 border-b-2 font-medium transition-colors ${
                selectedTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {loading ? (
            <Card className="p-8 text-center text-gray-500">{tCommon('loading', 'Loading...')}</Card>
          ) : requests.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">
              {tAdmin('noDeletionRequests', 'No {status} deletion requests').replace('{status}', statusLabel)}
            </Card>
          ) : (
            requests.map((request) => (
              <Card key={request.id} className="p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{request.resourceName}</h3>
                      <span className="text-xs px-2 py-1 bg-gray-200 rounded">
                        {request.resourceType}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded font-medium ${
                          request.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : request.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : request.status === 'EXECUTED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {tabLabel(request.status as 'PENDING' | 'APPROVED' | 'EXECUTED' | 'CANCELLED')}
                      </span>
                    </div>

                    {request.reason && (
                      <p className="text-sm text-gray-600 mb-3">
                        <strong>{tAdmin('reason', 'Reason:')}</strong> {request.reason}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">{tAdmin('requestedBy', 'Requested by')}</p>
                        <p className="font-medium">
                          {request.requestor.firstName} {request.requestor.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{request.requestor.email}</p>
                      </div>

                      {request.approver && (
                        <div>
                          <p className="text-gray-600">{tAdmin('approvedBy', 'Approved by')}</p>
                          <p className="font-medium">
                            {request.approver.firstName} {request.approver.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{request.approver.email}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-gray-600">{tAdmin('created', 'Created')}</p>
                        <p className="font-medium">{format(new Date(request.createdAt), 'MMM dd, yyyy')}</p>
                        <p className="text-xs text-gray-500">{format(new Date(request.createdAt), 'hh:mm a')}</p>
                      </div>

                      <div>
                        <p className="text-gray-600">
                          {request.status === 'PENDING'
                            ? tAdmin('willBeDeleted', 'Will be deleted')
                            : tAdmin('scheduledForDeletion', 'Scheduled for deletion')}
                        </p>
                        <p className="font-medium">{format(new Date(request.scheduledFor), 'MMM dd, yyyy')}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(request.scheduledFor), 'hh:mm a')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {request.status === 'PENDING' && (
                      <>
                        <Button
                          onClick={() => handleApprove(request.id)}
                          disabled={approving === request.id}
                          className="bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400"
                        >
                          {approving === request.id
                            ? tAdmin('approving', 'Approving...')
                            : tAdmin('approve', 'Approve')}
                        </Button>
                        <Button
                          onClick={() => handleCancel(request.id)}
                          disabled={cancelling === request.id}
                          className="bg-gray-500 text-white hover:bg-gray-600 disabled:bg-gray-400"
                        >
                          {cancelling === request.id
                            ? tAdmin('cancelling', 'Cancelling...')
                            : tAdmin('cancel', 'Cancel')}
                        </Button>
                      </>
                    )}

                    {request.status === 'APPROVED' && (
                      <>
                        <div className="text-xs bg-blue-50 text-blue-700 p-2 rounded text-center mb-2">
                          {tAdmin('scheduledForDate', 'Scheduled for {date}').replace(
                            '{date}',
                            format(new Date(request.scheduledFor), 'MMM dd, yyyy')
                          )}
                        </div>
                        <Button
                          onClick={() => handleExecute(request.id)}
                          disabled={executing === request.id}
                          className="bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400"
                        >
                          {executing === request.id
                            ? tAdmin('deleting', 'Deleting...')
                            : tAdmin('deleteNow', 'Delete Now')}
                        </Button>
                        <Button
                          onClick={() => handleCancel(request.id)}
                          disabled={cancelling === request.id}
                          className="bg-gray-500 text-white hover:bg-gray-600 disabled:bg-gray-400"
                        >
                          {cancelling === request.id
                            ? tAdmin('cancelling', 'Cancelling...')
                            : tAdmin('cancel', 'Cancel')}
                        </Button>
                      </>
                    )}

                    {request.status === 'EXECUTED' && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded text-center">
                        ✓ {tAdmin('executedLabel', 'Executed')}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Info Box */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>{tAdmin('howDeletionWorks', 'How deletion requests work')}</strong>{' '}
            {tAdmin(
              'howDeletionWorksBody',
              'Critical deletions require approval from a second admin. After approval, deletion is scheduled. You can cancel before execution.'
            )}
          </p>
        </Card>
      </div>
    </DashboardLayout>
  )
}
