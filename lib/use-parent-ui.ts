'use client'

import { useCallback } from 'react'
import { useLocale } from '@/lib/locale-context'
import { tParent } from '@/lib/parent-i18n'

export function useParentUi() {
  const { locale } = useLocale()

  const translate = useCallback(
    (key: string, fallback: string, section?: string) => tParent(locale, key, fallback, section),
    [locale]
  )

  return { locale, tParent: translate }
}
