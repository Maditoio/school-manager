'use client'

import { useCallback, useMemo } from 'react'
import { useLocale } from '@/lib/locale-context'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'

type StringMap = Record<string, string>

export function useStudentUi() {
  const { locale } = useLocale()

  const languageMessages = useMemo(() => {
    if (locale === 'fr') return frMessages
    if (locale === 'sw') return swMessages
    return enMessages
  }, [locale])

  const studentUi = useMemo(
    () => ((languageMessages as Record<string, unknown>).studentUi || {}) as StringMap,
    [languageMessages]
  )

  const tStudent = useCallback(
    (key: string, fallback: string, vars?: Record<string, string | number>) => {
      let text = studentUi[key] || fallback
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v))
        }
      }
      return text
    },
    [studentUi]
  )

  return { locale, tStudent }
}
