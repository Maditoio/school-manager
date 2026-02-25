'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { ClientLocale } from '@/lib/client-i18n'

const SUPPORTED_LOCALES: ClientLocale[] = ['en', 'fr', 'sw']

function isSupportedLocale(value: string | null | undefined): value is ClientLocale {
  return !!value && SUPPORTED_LOCALES.includes(value as ClientLocale)
}

function getLocaleFromCookie(): ClientLocale | null {
  if (typeof document === 'undefined') return null
  const cookieMatch = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/)
  const cookieLocale = cookieMatch?.[1]
  return isSupportedLocale(cookieLocale) ? cookieLocale : null
}

function getInitialLocale(): ClientLocale {
  return getLocaleFromCookie() || 'en'
}

interface LocaleContextValue {
  locale: ClientLocale
  setLocale: (next: ClientLocale) => void
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [locale, setLocaleState] = useState<ClientLocale>(getInitialLocale)

  useEffect(() => {
    const cookieLocale = getLocaleFromCookie()
    if (!cookieLocale) {
      const sessionLocale = session?.user?.preferredLanguage
      if (isSupportedLocale(sessionLocale) && sessionLocale !== locale) {
        setLocaleState(sessionLocale)
      }
    }
  }, [session?.user?.preferredLanguage, locale])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo(
    () => ({
      locale,
      setLocale: (next: ClientLocale) => setLocaleState(next),
    }),
    [locale]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return context
}
