import { getRequestConfig } from 'next-intl/server'

export const locales = ['en', 'fr', 'sw'] as const
export type Locale = (typeof locales)[number]

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale: Locale = locales.includes(locale as Locale)
    ? (locale as Locale)
    : 'en'

  return {
    locale: resolvedLocale,
    messages: (await import(`./messages/${resolvedLocale}.json`)).default,
  }
})
