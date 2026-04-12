'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Globe, GraduationCap, Moon, Sun } from 'lucide-react'

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'sw', label: 'Swahili' },
]

export default function Toolbar({
  sidebarOpen,
  schoolName,
  theme,
  onThemeToggle,
  language,
  onLanguageChange,
}) {
  const [isLanguageOpen, setIsLanguageOpen] = useState(false)
  const [activeOptionIndex, setActiveOptionIndex] = useState(0)
  const languageButtonRef = useRef(null)
  const languageMenuRef = useRef(null)

  const selectedLanguage = useMemo(
    () =>
      LANGUAGE_OPTIONS.find((item) => item.code === String(language || '').toLowerCase()) ||
      LANGUAGE_OPTIONS[0],
    [language]
  )

  const sidebarWidth = sidebarOpen ? 240 : 64
  const isDark = String(theme || '').toLowerCase() !== 'light'

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!isLanguageOpen) return

      const target = event.target
      const clickedButton = languageButtonRef.current?.contains(target)
      const clickedMenu = languageMenuRef.current?.contains(target)

      if (!clickedButton && !clickedMenu) {
        setIsLanguageOpen(false)
      }
    }

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setIsLanguageOpen(false)
        languageButtonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [isLanguageOpen])

  const handleLanguageButtonKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setActiveOptionIndex(
        LANGUAGE_OPTIONS.findIndex((item) => item.code === selectedLanguage.code)
      )
      setIsLanguageOpen((prev) => !prev)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsLanguageOpen(true)
      setActiveOptionIndex(
        LANGUAGE_OPTIONS.findIndex((item) => item.code === selectedLanguage.code)
      )
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsLanguageOpen(true)
      setActiveOptionIndex(
        LANGUAGE_OPTIONS.findIndex((item) => item.code === selectedLanguage.code)
      )
    }
  }

  const handleLanguageListKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveOptionIndex((prev) => (prev + 1) % LANGUAGE_OPTIONS.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveOptionIndex((prev) => (prev - 1 + LANGUAGE_OPTIONS.length) % LANGUAGE_OPTIONS.length)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const selected = LANGUAGE_OPTIONS[activeOptionIndex]
      if (selected) {
        onLanguageChange?.(selected.code)
        setIsLanguageOpen(false)
        languageButtonRef.current?.focus()
      }
      return
    }

    if (event.key === 'Tab') {
      setIsLanguageOpen(false)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setIsLanguageOpen(false)
      languageButtonRef.current?.focus()
    }
  }

  return (
    <header
      className="fixed top-0 right-0 z-30 h-16"
      style={{
        left: `${sidebarWidth}px`,
        transition: 'left 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.86)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className={`relative h-full px-5 sm:px-6 ${isDark ? 'border-b border-white/5' : 'border-b border-slate-200/80'}`}>
        <div
          className="absolute inset-x-0 bottom-0 h-px"
          style={{
            background:
              isDark
                ? 'linear-gradient(to right, rgba(99,102,241,0), rgba(99,102,241,0.35), rgba(99,102,241,0))'
                : 'linear-gradient(to right, rgba(99,102,241,0), rgba(99,102,241,0.25), rgba(99,102,241,0))',
          }}
        />

        <div className="flex h-full items-center justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <GraduationCap className={`h-4 w-4 shrink-0 ${isDark ? 'text-indigo-400/70' : 'text-indigo-600'}`} aria-hidden="true" />
            <p
              className="truncate text-lg font-semibold tracking-tight sm:text-xl"
              style={{
                fontFamily: '"Plus Jakarta Sans", "DM Sans", system-ui, sans-serif',
                color: isDark ? undefined : '#0f172a',
                backgroundImage: isDark ? 'linear-gradient(90deg, #ffffff 0%, #f1f5f9 78%, #c7d2fe 100%)' : undefined,
                WebkitBackgroundClip: isDark ? 'text' : undefined,
                WebkitTextFillColor: isDark ? 'transparent' : undefined,
              }}
            >
              {schoolName || 'School Dashboard'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                ref={languageButtonRef}
                type="button"
                aria-label="Select language"
                aria-haspopup="listbox"
                aria-expanded={isLanguageOpen}
                aria-controls="toolbar-language-listbox"
                onClick={() => {
                  setActiveOptionIndex(
                    LANGUAGE_OPTIONS.findIndex((item) => item.code === selectedLanguage.code)
                  )
                  setIsLanguageOpen((prev) => !prev)
                }}
                onKeyDown={handleLanguageButtonKeyDown}
                className="group inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-200 transition-all duration-200 ease-in-out hover:border-indigo-300/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/50"
              >
                <Globe className="h-3.5 w-3.5 text-indigo-300/85 transition-colors duration-200 ease-in-out group-hover:text-indigo-200" />
                <span>{selectedLanguage.code.toUpperCase()}</span>
              </button>

              <div
                className={`absolute right-0 top-11 w-44 origin-top-right rounded-xl border border-white/15 bg-[#13151F]/80 p-1.5 backdrop-blur-xl transition-all duration-150 ease-in-out ${
                  isLanguageOpen
                    ? 'pointer-events-auto translate-y-0 opacity-100'
                    : 'pointer-events-none -translate-y-1.5 opacity-0'
                }`}
                role="presentation"
              >
                <ul
                  id="toolbar-language-listbox"
                  ref={languageMenuRef}
                  role="listbox"
                  aria-label="Language options"
                  tabIndex={isLanguageOpen ? 0 : -1}
                  onKeyDown={handleLanguageListKeyDown}
                  className="space-y-1"
                >
                  {LANGUAGE_OPTIONS.map((option, index) => {
                    const isSelected = option.code === selectedLanguage.code
                    const isActive = index === activeOptionIndex

                    return (
                      <li key={option.code} role="option" aria-selected={isSelected}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveOptionIndex(index)}
                          onClick={() => {
                            onLanguageChange?.(option.code)
                            setIsLanguageOpen(false)
                            languageButtonRef.current?.focus()
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all duration-200 ease-in-out ${
                            isActive
                              ? 'bg-white/10 text-white'
                              : 'text-slate-300 hover:bg-white/8 hover:text-slate-100'
                          }`}
                        >
                          <span>{option.label}</span>
                          {isSelected ? (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-300">
                              Active
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            <button
              type="button"
              aria-label="Toggle theme"
              onClick={onThemeToggle}
              className="relative inline-flex h-9 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-100 transition-all duration-200 ease-in-out hover:border-indigo-300/40 hover:bg-white/10 hover:shadow-[0_0_0_2px_rgba(99,102,241,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/50"
            >
              <span className="relative h-5 w-5">
                <Sun
                  aria-hidden="true"
                  className={`absolute inset-0 h-5 w-5 text-amber-300 transition-all duration-300 ease-in-out ${
                    isDark ? 'rotate-360 opacity-0' : 'rotate-0 opacity-100'
                  }`}
                />
                <Moon
                  aria-hidden="true"
                  className={`absolute inset-0 h-5 w-5 text-indigo-200 transition-all duration-300 ease-in-out ${
                    isDark ? 'rotate-0 opacity-100' : '-rotate-360 opacity-0'
                  }`}
                />
              </span>
            </button>

            <div className="h-6 w-px bg-white/15" aria-hidden="true" />
          </div>
        </div>
      </div>
    </header>
  )
}
