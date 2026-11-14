export type UiFontScale = 'normal' | 'large' | 'x-large'

const FONT_SCALE_KEY = 'ui-font-scale'

const listeners = new Set<() => void>()

export function isUiFontScale(value: string | null | undefined): value is UiFontScale {
  return value === 'normal' || value === 'large' || value === 'x-large'
}

function readCookieFontScale(): UiFontScale | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)ui-font-scale=([^;]*)/)
  if (!match) return null
  try {
    const value = decodeURIComponent(match[1])
    return isUiFontScale(value) ? value : null
  } catch {
    return null
  }
}

/** Prefer localStorage, then cookie, then the current data-font-scale attribute. */
export function readStoredFontScale(): UiFontScale {
  try {
    const fromStorage = localStorage.getItem(FONT_SCALE_KEY)
    if (isUiFontScale(fromStorage)) return fromStorage
  } catch {
    // ignore storage access errors
  }

  const fromCookie = readCookieFontScale()
  if (fromCookie) return fromCookie

  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-font-scale')
    if (isUiFontScale(attr)) return attr
  }

  return 'normal'
}

export function applyUiFontScale(scale: UiFontScale) {
  if (typeof document === 'undefined') return

  document.documentElement.setAttribute('data-font-scale', scale)

  try {
    localStorage.setItem(FONT_SCALE_KEY, scale)
  } catch {
    // ignore storage errors
  }

  try {
    document.cookie = `${FONT_SCALE_KEY}=${encodeURIComponent(scale)}; path=/; max-age=31536000; SameSite=Lax`
  } catch {
    // ignore cookie errors
  }
}

export function subscribeUiFontScale(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStoreChange)
  }
  return () => {
    listeners.delete(onStoreChange)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStoreChange)
    }
  }
}

export function getUiFontScaleSnapshot(): UiFontScale {
  return readStoredFontScale()
}

export function getUiFontScaleServerSnapshot(): UiFontScale {
  return 'normal'
}

export function setUiFontScale(scale: UiFontScale) {
  applyUiFontScale(scale)
  listeners.forEach((listener) => listener())
}

export function cycleUiFontScale(current: UiFontScale): UiFontScale {
  if (current === 'normal') return 'large'
  if (current === 'large') return 'x-large'
  return 'normal'
}

export const UI_FONT_SCALE_LABEL: Record<UiFontScale, string> = {
  normal: 'Default',
  large: 'Large',
  'x-large': 'Extra large',
}
