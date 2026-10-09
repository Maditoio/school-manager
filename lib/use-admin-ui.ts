'use client'

import { useCallback, useMemo } from 'react'
import { useLocale } from '@/lib/locale-context'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'

type StringMap = Record<string, string>

export function useAdminUi() {
  const { locale } = useLocale()

  const languageMessages = useMemo(() => {
    if (locale === 'fr') return frMessages
    if (locale === 'sw') return swMessages
    return enMessages
  }, [locale])

  const adminUi = useMemo(
    () => ((languageMessages as Record<string, unknown>).adminUi || {}) as StringMap,
    [languageMessages]
  )

  const common = useMemo(
    () => ((languageMessages as Record<string, unknown>).common || {}) as StringMap,
    [languageMessages]
  )

  const tAdmin = useCallback((key: string, fallback: string) => adminUi[key] || fallback, [adminUi])
  const tCommon = useCallback((key: string, fallback: string) => common[key] || fallback, [common])

  return { locale, languageMessages, tAdmin, tCommon }
}
