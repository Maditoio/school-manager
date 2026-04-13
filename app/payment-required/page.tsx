import Link from 'next/link'

export default function PaymentRequiredPage() {
  return (
    <div className="min-h-screen bg-amber-50 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-amber-900">Payment Required</h1>
        <p className="mt-4 text-sm leading-6 text-amber-900/80">
          Portal access is currently disabled because the linked student is not yet covered by the current school license.
          Please contact the school finance office to record the extra student license if needed.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
