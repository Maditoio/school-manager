'use client'

import { useCallback, useMemo } from 'react'
import { useLocale } from '@/lib/locale-context'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'

type StringMap = Record<string, string>
type NestedMap = Record<string, StringMap>

export function useTeacherUi() {
  const { locale } = useLocale()

  const languageMessages = useMemo(() => {
    if (locale === 'fr') return frMessages
    if (locale === 'sw') return swMessages
    return enMessages
  }, [locale])

  const teacher = useMemo(
    () => ((languageMessages as Record<string, unknown>).teacher || {}) as NestedMap,
    [languageMessages]
  )

  const common = useMemo(
    () => ((languageMessages as Record<string, unknown>).common || {}) as StringMap,
    [languageMessages]
  )

  const tTeacher = useCallback(
    (section: string, key: string, fallback: string) => teacher[section]?.[key] || fallback,
    [teacher]
  )

  const tCommon = useCallback((key: string, fallback: string) => common[key] || fallback, [common])

  return { locale, languageMessages, teacher, tTeacher, tCommon }
}
