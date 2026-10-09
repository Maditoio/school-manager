export type UiTheme = 'light' | 'dark' | 'calm'

const THEME_KEY = 'ui-theme'
const THEME_COLOR: Record<UiTheme, string> = {
  light: '#f5f6f8',
  dark: '#0f1720',
  calm: '#f5f8f5',
}

const listeners = new Set<() => void>()

export function isUiTheme(value: string | null | undefined): value is UiTheme {
  return value === 'light' || value === 'dark' || value === 'calm'
}

function readCookieTheme(): UiTheme | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)ui-theme=([^;]*)/)
  if (!match) return null
  try {
    const value = decodeURIComponent(match[1])
    return isUiTheme(value) ? value : null
  } catch {
    return null
  }
}

/** Prefer localStorage, then cookie, then the current data-theme attribute. */
export function readStoredTheme(): UiTheme {
  try {
    const fromStorage = localStorage.getItem(THEME_KEY)
    if (isUiTheme(fromStorage)) return fromStorage
  } catch {
    // ignore storage access errors
  }

  const fromCookie = readCookieTheme()
  if (fromCookie) return fromCookie

  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme')
    if (isUiTheme(attr)) return attr
  }

  return 'light'
}

export function applyUiTheme(theme: UiTheme) {
  if (typeof document === 'undefined') return

  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'

  document.querySelectorAll('meta[name="theme-color"]').forEach((metaTheme) => {
    metaTheme.setAttribute('content', THEME_COLOR[theme])
  })

  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // ignore storage errors
  }

  try {
    document.cookie = `${THEME_KEY}=${encodeURIComponent(theme)}; path=/; max-age=31536000; SameSite=Lax`
  } catch {
    // ignore cookie errors
  }
}

export function subscribeUiTheme(onStoreChange: () => void) {
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

export function getUiThemeSnapshot(): UiTheme {
  return readStoredTheme()
}

export function getUiThemeServerSnapshot(): UiTheme {
  return 'light'
}

export function setUiTheme(theme: UiTheme) {
  applyUiTheme(theme)
  listeners.forEach((listener) => listener())
}
