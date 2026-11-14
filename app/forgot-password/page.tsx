'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'

const CONTACT_ADMIN_MESSAGE =
  'Password reset is only available for email accounts. Students and teachers who sign in with a student number or phone should contact their school administrator.'

function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed.includes('@')) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const trimmed = email.trim()
    if (!looksLikeEmail(trimmed)) {
      setError(CONTACT_ADMIN_MESSAGE)
      return
    }

    try {
      setIsLoading(true)
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })

      const result = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(result.error || 'Failed to reset password. Please try again.')
        return
      }

      setSuccess(
        result.message ||
          'If an account with that email exists, you can sign in with the temporary password default12345. You will be asked to change it after signing in.'
      )
    } catch {
      setError('Failed to reset password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f9fc] flex items-center justify-center p-4">
      <div className="bg-white rounded-[10px] border border-[#e0e6ed] p-8 w-full max-w-md">
        <h1 className="text-[1.25rem] font-semibold text-[#0a2540] mb-2">Forgot password</h1>
        <p className="text-sm text-[#8898aa] mb-6">
          Enter the email address for your account. Password reset is only available for email
          logins — not student numbers or phone numbers.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />

          {error ? <p className="text-sm text-[#c0392b]">{error}</p> : null}
          {success ? <p className="text-sm text-[#1b8a5a]">{success}</p> : null}

          <Button type="submit" className="w-full" isLoading={isLoading}>
            Reset password
          </Button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-[#635bff] font-medium hover:text-[#5146e8]">
            Back to sign in →
          </Link>
        </p>
      </div>
    </div>
  )
}
