'use client'

import { useId } from 'react'
import { translateText, type ClientLocale } from '@/lib/client-i18n'

export const LANGUAGE_SWITCHER_OPTIONS = [
  { code: 'en', short: 'EN' },
  { code: 'fr', short: 'FR' },
  { code: 'sw', short: 'SW' },
] as const

export type LanguageSwitcherCode = (typeof LANGUAGE_SWITCHER_OPTIONS)[number]['code']

const LANGUAGE_NAME_BY_LOCALE: Record<ClientLocale, Record<LanguageSwitcherCode, string>> = {
  en: { en: 'English', fr: 'French', sw: 'Swahili' },
  fr: { en: 'Anglais', fr: 'Français', sw: 'Swahili' },
  sw: { en: 'Kiingereza', fr: 'Kifaransa', sw: 'Kiswahili' },
}

interface LanguageSwitcherProps {
  value: string
  onChange: (code: LanguageSwitcherCode) => void
  locale?: string
  /** Visually hide the “Language” label while keeping it for screen readers */
  hideLabel?: boolean
  className?: string
  size?: 'sm' | 'md'
}

function resolveLocale(raw: string | undefined): ClientLocale {
  const value = String(raw || 'en').toLowerCase()
  if (value === 'fr' || value === 'sw') return value
  return 'en'
}

export function LanguageSwitcher({
  value,
  onChange,
  locale,
  hideLabel = false,
  className = '',
  size = 'sm',
}: LanguageSwitcherProps) {
  const groupId = useId()
  const activeLocale = resolveLocale(locale || value)
  const active = resolveLocale(value || locale)
  const label = translateText('Language', activeLocale)
  const pad = size === 'md' ? 'px-2.5 py-1.5' : 'px-2 py-1.5'
  const textSize = size === 'md' ? 'text-[13px]' : 'text-[12px]'
  const names = LANGUAGE_NAME_BY_LOCALE[activeLocale]

  return (
    <div className={className}>
      <p
        id={groupId}
        className={`mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.07em] ui-text-secondary ${
          hideLabel ? 'sr-only' : ''
        }`}
      >
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={groupId}
        className="flex gap-0.5 rounded-[6px] border border-(--border-subtle) bg-(--surface) p-0.5"
      >
        {LANGUAGE_SWITCHER_OPTIONS.map((option) => {
          const selected = active === option.code
          const optionName = names[option.code]
          return (
            <button
              key={option.code}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-pressed={selected}
              aria-label={optionName}
              title={optionName}
              onClick={() => onChange(option.code)}
              className={`flex-1 rounded-[4px] ${pad} ${textSize} font-semibold tracking-[0.04em] transition-all duration-[150ms] ease-[ease] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#635bff] ${
                selected
                  ? 'bg-[#f0effe] text-[#635bff]'
                  : 'ui-text-secondary hover:bg-[#f6f9fc] hover:ui-text-primary'
              }`}
            >
              {option.short}
            </button>
          )
        })}
      </div>
    </div>
  )
}
