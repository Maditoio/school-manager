'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'

function getDashboardForRole(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN': return '/super-admin/dashboard'
    case 'SCHOOL_ADMIN': return '/admin/dashboard'
    case 'DEPUTY_ADMIN': return '/admin/dashboard'
    case 'FINANCE': return '/finance/fees'
    case 'FINANCE_MANAGER': return '/finance/expenses'
    case 'TEACHER': return '/teacher/dashboard'
    case 'PARENT': return '/parent/dashboard'
    case 'STUDENT': return '/student/dashboard'
    default: return '/login'
  }
}

export default function ResetPasswordPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  if (!session?.user) {
    redirect('/login')
  }

  const requiresReset = session.user.mustResetPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    try {
      setIsLoading(true)
      const res = await fetch('/api/users/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const result = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(result.error || 'Failed to update password')
        return
      }

      setSuccess('Password updated successfully. Redirecting…')

      // Update the session token so mustResetPassword is cleared, then go to dashboard
      await update({ mustResetPassword: false })
      router.replace(getDashboardForRole(session!.user.role))
    } catch {
      setError('Failed to update password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h1>
        <p className="text-sm text-gray-600 mb-6">
          {requiresReset
            ? 'You must change your password before continuing.'
            : 'Update your password to keep your account secure.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!requiresReset ? (
            <Input
              type="password"
              label="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          ) : null}

          <Input
            type="password"
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="Minimum 6 characters"
          />

          <Input
            type="password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-green-600">{success}</p> : null}

          <Button type="submit" className="w-full" isLoading={isLoading}>
            Save Password
          </Button>
        </form>
      </div>
    </div>
  )
}
