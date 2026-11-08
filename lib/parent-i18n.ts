import frMessages from '@/messages/fr.json'
import enMessages from '@/messages/en.json'
import swMessages from '@/messages/sw.json'

export function pickParentMessages(lang: string) {
  if (lang === 'fr') return frMessages
  if (lang === 'sw') return swMessages
  return enMessages
}

/** Resolve a key from parent.dashboard first, then parent.<section>, then fallback. */
export function tParent(lang: string, key: string, fallback: string, section?: string) {
  const pack = pickParentMessages(lang) as Record<string, unknown>
  const parent = (pack.parent || {}) as Record<string, unknown>
  const dashboard = (parent.dashboard || {}) as Record<string, string>
  if (dashboard[key]) return dashboard[key]
  if (section) {
    const sectionBag = (parent[section] || {}) as Record<string, string>
    if (sectionBag[key]) return sectionBag[key]
  }
  return fallback
}

export function formatParentDate(value: Date | string, lang: string, withWeekday = false) {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'sw' ? 'sw-TZ' : 'en-GB', {
    ...(withWeekday ? { weekday: 'short' as const } : {}),
    day: 'numeric',
    month: 'short',
    year: withWeekday ? 'numeric' : undefined,
  })
}

export function attendanceTone(status: string): 'success' | 'danger' | 'pending' {
  if (status === 'PRESENT') return 'success'
  if (status === 'LATE') return 'pending'
  return 'danger'
}

export function attendanceLabel(status: string, lang: string) {
  if (status === 'PRESENT') return tParent(lang, 'present', 'Présent')
  if (status === 'LATE') return tParent(lang, 'late', 'En retard')
  return tParent(lang, 'absent', 'Absent')
}

export function assessmentTypeLabel(type: string, lang: string) {
  const key = String(type || '').toUpperCase()
  if (key === 'QUIZ') return tParent(lang, 'typeQuiz', 'Quiz')
  if (key === 'TEST') return tParent(lang, 'typeTest', 'Test')
  if (key === 'EXAM') return tParent(lang, 'typeExam', 'Exam')
  if (key === 'ASSIGNMENT') return tParent(lang, 'typeAssignment', 'Assignment')
  return type
}

export function genderLabel(gender: string | null | undefined, lang: string) {
  const key = String(gender || '').toUpperCase()
  if (key === 'MALE') return tParent(lang, 'genderMale', 'Male')
  if (key === 'FEMALE') return tParent(lang, 'genderFemale', 'Female')
  return gender || '—'
}
