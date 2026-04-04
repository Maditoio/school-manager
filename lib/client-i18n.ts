import React from 'react'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'

export type ClientLocale = 'en' | 'fr' | 'sw'

type AnyRecord = Record<string, unknown>

function flattenStringPaths(source: AnyRecord, prefix: string[] = [], output: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(source)) {
    const path = [...prefix, key]
    if (typeof value === 'string') {
      output[path.join('.')] = value
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenStringPaths(value as AnyRecord, path, output)
    }
  }
  return output
}

const enFlat = flattenStringPaths(enMessages as AnyRecord)
const frFlat = flattenStringPaths(frMessages as AnyRecord)
const swFlat = flattenStringPaths(swMessages as AnyRecord)

function buildLookup(targetFlat: Record<string, string>) {
  const lookup = new Map<string, string>()

  for (const [path, enValue] of Object.entries(enFlat)) {
    const targetValue = targetFlat[path]
    if (!targetValue || targetValue === enValue) continue

    lookup.set(enValue, targetValue)

    if (enValue.endsWith(':') && targetValue.endsWith(':')) {
      lookup.set(enValue.slice(0, -1), targetValue.slice(0, -1))
    }
  }

  return lookup
}

const frLookup = buildLookup(frFlat)
const swLookup = buildLookup(swFlat)

function getLookup(locale: ClientLocale) {
  if (locale === 'fr') return frLookup
  if (locale === 'sw') return swLookup
  return null
}

export function getClientLocale(): ClientLocale {
  if (typeof document === 'undefined') return 'en'

  const cookieMatch = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/)
  const cookieLocale = cookieMatch?.[1] as ClientLocale | undefined

  if (cookieLocale === 'fr' || cookieLocale === 'sw' || cookieLocale === 'en') {
    return cookieLocale
  }

  const htmlLang = document.documentElement.lang as ClientLocale
  if (htmlLang === 'fr' || htmlLang === 'sw' || htmlLang === 'en') {
    return htmlLang
  }

  return 'en'
}

export function translateText(text: string, locale: ClientLocale): string {
  if (!text || locale === 'en') return text

  const lookup = getLookup(locale)
  if (!lookup) return text

  const exact = lookup.get(text)
  if (exact) return exact

  const trimmed = text.trim()
  if (!trimmed) return text

  const translatedTrimmed = lookup.get(trimmed)
  if (!translatedTrimmed) return text

  const leading = text.match(/^\s*/)?.[0] || ''
  const trailing = text.match(/\s*$/)?.[0] || ''
  return `${leading}${translatedTrimmed}${trailing}`
}

export function translateDashboardDynamic(text: string, locale: ClientLocale): string {
  const translated = translateText(text, locale)
  if (translated !== text) return translated
  if (locale !== 'fr') return text

  let out = text

  out = out.replace(/^(\+?\-?\d+(?:\.\d+)?)% vs last term$/i, '$1% par rapport au trimestre dernier')
  out = out.replace(/^(\+?\-?\d+(?:\.\d+)?)% vs last week$/i, '$1% par rapport a la semaine derniere')
  out = out.replace(/^(\+?\-?\d+(?:\.\d+)?)% vs Year (\d{4})$/i, '$1% par rapport a l\'annee $2')
  out = out.replace(/^(\+?\-?\d+(?:\.\d+)?)% vs yesterday$/i, '$1% par rapport a hier')
  out = out.replace(/^(\d+(?:\.\d+)?)% of students$/i, '$1% des etudiants')
  out = out.replace(/^(\d+) new this term$/i, '$1 nouveaux ce trimestre')
  out = out.replace(/^(\d+(?:\.\d+)?)% absent today$/i, '$1% absents aujourd\'hui')
  out = out.replace(/^(\d+) submissions awaiting grading$/i, '$1 soumissions en attente de correction')
  out = out.replace(/^(\d+) teachers have no subject assignment$/i, '$1 enseignants n\'ont pas d\'attribution de matiere')
  out = out.replace(/^(\d+) teachers on approved off-day today$/i, '$1 enseignants en conge approuve aujourd\'hui')
  out = out.replace(/^(\d+) alerts$/i, '$1 alertes')
  out = out.replace(/^Financial Health · Year (\d{4})$/i, 'Sante financiere · Annee $1')
  out = out.replace(/^(\d+) accounts · (.+)$/i, '$1 comptes · $2')
  out = out.replace(/^(\d+) payments · (.+)$/i, '$1 paiements · $2')
  out = out.replace(/^(\d+) more teachers not shown\.$/i, '$1 enseignants supplementaires non affiches.')
  out = out.replace(/^View all (\d+) teachers →$/i, 'Voir les $1 enseignants →')
  out = out.replace(/^(\d+[\d\s]*) \((\d+) payments\)$/i, '$1 ($2 paiements)')
  out = out.replace(/^(\d+(?:\.\d+)?)% collected$/i, '$1% collecte')
  out = out.replace(/^(\d+(?:\.\d+)?)% · R ([\d\s]+) of R ([\d\s]+)$/i, '$1% · R $2 sur R $3')

  return out
}

function translateProps(props: Record<string, unknown>, locale: ClientLocale) {
  const translatedProps: Record<string, unknown> = { ...props }
  const textProps = ['label', 'placeholder', 'title', 'aria-label', 'alt']

  for (const propName of textProps) {
    const value = translatedProps[propName]
    if (typeof value === 'string') {
      translatedProps[propName] = translateText(value, locale)
    }
  }

  if (typeof translatedProps.className === 'string') {
    translatedProps.className = translatedProps.className
  }

  return translatedProps
}

export function translateNode(node: React.ReactNode, locale: ClientLocale): React.ReactNode {
  if (locale === 'en') return node

  if (typeof node === 'string') {
    return translateText(node, locale)
  }

  if (Array.isArray(node)) {
    return node.map((child) => translateNode(child, locale))
  }

  if (!React.isValidElement(node)) {
    return node
  }

  const translatedProps = translateProps(node.props as Record<string, unknown>, locale)

  if ('children' in translatedProps) {
    translatedProps.children = translateNode(translatedProps.children as React.ReactNode, locale)
  }

  return React.cloneElement(node, translatedProps)
}
