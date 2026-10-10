'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import Image from 'next/image'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        schoolCode: schoolCode.trim() || undefined,
        redirect: false,
      })

      if (!result || result.error || result.ok === false) {
        const url = result?.url || ''
        let errorCode = (result as { code?: string } | undefined)?.code || ''

        if (!errorCode && url) {
          try {
            const parsed = new URL(url, window.location.origin)
            errorCode = parsed.searchParams.get('code') || ''
          } catch {
            errorCode = ''
          }
        }

        // Auth.js sometimes puts the custom code in the error string.
        if (!errorCode && typeof result?.error === 'string') {
          if (result.error.includes('school_required')) errorCode = 'school_required'
          else if (result.error.includes('account_suspended')) errorCode = 'account_suspended'
          else if (result.error.includes('school_inactive')) errorCode = 'school_inactive'
        }

        if (errorCode === 'account_suspended') {
          setError('Your account has been suspended. Please contact the administrator.')
        } else if (errorCode === 'school_inactive') {
          setError('Your school account is currently inactive. Please contact the administrator.')
        } else if (errorCode === 'school_required') {
          setError('This admission number exists at more than one school. Enter your school code to continue.')
        } else if (result?.error && result.error !== 'CredentialsSignin') {
          setError(result.error)
        } else {
          setError('Invalid email or password. Please check your credentials and try again.')
        }
      } else {
        // Successful login - redirect will happen automatically
        router.push('/')
        router.refresh()
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage: 'url("https://images.unsplash.com/photo-1427504494785-cdbb8d996fc5?w=1400&h=1400&fit=crop")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Background decorative elements with adjusted opacity */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left Side - Branding */}
          <div className="hidden md:flex flex-col justify-center space-y-8">
            {/* School Icon/Logo */}
            <div className="space-y-6">
              <Image
                src="/azelio-logo.png"
                alt="Azelio"
                width={80}
                height={80}
                className="rounded-2xl shadow-lg"
                priority
              />

              <div>
                <h1 className="text-4xl font-bold text-white leading-tight drop-shadow-lg">
                  Welcome to<br />
                  <span className="bg-gradient-to-r from-emerald-200 to-teal-200 bg-clip-text text-transparent">
                    Azelio
                  </span>
                </h1>
              </div>

              <p className="text-lg text-gray-100 leading-relaxed drop-shadow-md">
                School Management, Simplified.
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-4">
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white drop-shadow-md">Real-time Updates</h3>
                  <p className="text-sm text-gray-200 drop-shadow-sm">Stay informed with instant notifications</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white drop-shadow-md">Secure Access</h3>
                  <p className="text-sm text-gray-200 drop-shadow-sm">Protected with enterprise-level security</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white drop-shadow-md">Easy Management</h3>
                  <p className="text-sm text-gray-200 drop-shadow-sm">Simplify academic workflows</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="w-full max-w-md mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl backdrop-blur-sm bg-opacity-98 p-8 space-y-6">
              {/* Mobile Logo */}
              <div className="md:hidden text-center mb-4">
                <Image
                  src="/azelio-logo.png"
                  alt="Azelio"
                  width={64}
                  height={64}
                  className="rounded-2xl shadow-lg mx-auto mb-4"
                  priority
                />
                <h1 className="text-2xl font-bold text-gray-900">Azelio</h1>
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Sign In</h2>
                <p className="text-gray-600 text-sm">Access your school account</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex gap-3">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="text-red-700 text-sm font-medium">{error}</div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                    Email, phone, or admission number
                  </label>
                  <input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com, +2557…, or STU001"
                    required
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 text-gray-900"
                  />
                </div>

                <div>
                  <label htmlFor="schoolCode" className="block text-sm font-medium text-gray-900 mb-2">
                    School code <span className="text-gray-500 font-normal">(students, if required)</span>
                  </label>
                  <input
                    id="schoolCode"
                    type="text"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                    placeholder="e.g. DEMOSCH"
                    autoComplete="organization"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 text-gray-900"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Required when the same admission number is used at more than one school.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-900">
                      Password
                    </label>
                    <Link href="/reset-password" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                      Forgot?
                    </Link>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 text-gray-900"
                  />
                </div>

                {/* Remember Me */}
                <div className="flex items-center">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                  />
                  <label htmlFor="remember" className="ml-2 text-sm text-gray-700 cursor-pointer">
                    Remember me
                  </label>
                </div>

                {/* Sign In Button */}
                <Button
                  type="submit"
                  isLoading={isLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  Sign In to Your Account
                </Button>
              </form>

              {/* Footer */}
              <p className="text-center text-xs text-gray-600">
                Protected by enterprise-grade security. Your data is safe with us.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
