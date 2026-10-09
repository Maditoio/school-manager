'use client'

import { Suspense } from 'react'
import SchoolInvoicePage from '@/components/billing/SchoolInvoicePage'

export default function FinanceBillingPage() {
  return (
    <Suspense fallback={null}>
      <SchoolInvoicePage />
    </Suspense>
  )
}
