'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

export type CurrencyCode = 'USD' | 'ZAR' | 'FCFA' | 'CDF'

export interface CurrencyOption {
  code: CurrencyCode
  label: string
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'USD',  label: 'USD – US Dollar' },
  { code: 'ZAR',  label: 'R – South African Rand' },
  { code: 'FCFA', label: 'FCFA – CFA Franc (BEAC/BCEAO)' },
  { code: 'CDF',  label: 'CDF – Congolese Franc' },
]

const VALID_CODES = CURRENCY_OPTIONS.map(o => o.code)

function formatAmount(currency: CurrencyCode, amount: number): string {
  switch (currency) {
    case 'USD':
      return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case 'ZAR':
      return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case 'FCFA':
      return `FCFA ${Math.round(amount).toLocaleString('fr-FR')}`
    case 'CDF':
      return `FC ${amount.toLocaleString('fr-CD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    default:
      return `${amount.toFixed(2)}`
  }
}

interface CurrencyContextValue {
  currency: CurrencyCode
  formatCurrency: (amount: number) => string
  setCurrency: (code: CurrencyCode) => void
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [currency, setCurrencyState] = useState<CurrencyCode>('ZAR')
  const [loaded, setLoaded] = useState(false)

  // Fetch currency from school settings once the session is available
  useEffect(() => {
    if (!session?.user || loaded) return

    fetch('/api/schools/settings')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.currency && VALID_CODES.includes(data.currency)) {
          setCurrencyState(data.currency as CurrencyCode)
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.schoolId])

  const setCurrency = useCallback((code: CurrencyCode) => {
    if (VALID_CODES.includes(code)) {
      setCurrencyState(code)
    }
  }, [])

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      formatCurrency: (amount: number) => formatAmount(currency, amount),
      setCurrency,
    }),
    [currency, setCurrency]
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider')
  }
  return context
}
