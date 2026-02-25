'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'

export default function SchoolSuspendedPage() {
  useEffect(() => {
    // This page is accessible to all authenticated users whose school is suspended
  }, [])

  return (
    <div className="min-h-screen bg-linear-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="text-6xl mb-4">🚫</div>
        
        <h1 className="text-3xl font-bold text-red-900 mb-2">School Suspended</h1>
        
        <p className="text-gray-700 mb-6">
          Your school has been suspended by the system administrator. You can no longer access the platform's features.
        </p>

        <p className="text-sm text-gray-600 mb-8">
          For more information or to appeal this decision, please contact support.
        </p>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
