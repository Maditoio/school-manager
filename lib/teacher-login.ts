import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'

export const SYSTEM_EMAIL_DOMAIN = 'system.local'

export function isSystemEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith(`@${SYSTEM_EMAIL_DOMAIN}`)
}

export function generateSyntheticTeacherEmail(userId?: string): string {
  return `teacher-${userId || randomUUID()}@${SYSTEM_EMAIL_DOMAIN}`
}

/** Digits-only phone suitable as a login username (keeps leading +). */
export function normalizePhoneUsername(phone: string): string {
  const trimmed = phone.trim()
  if (!trimmed) return ''
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  return hasPlus ? `+${digits}` : digits
}

export function buildNameUsername(firstName: string, lastName: string): string {
  const base = `${firstName}.${lastName}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '')
  return base || `teacher.${randomUUID().slice(0, 8)}`
}

/**
 * Prefer phone as login username; fall back to first.last.
 * Ensures uniqueness against User.username (and email when colliding).
 */
export async function resolveTeacherLoginIdentity(input: {
  email?: string | null
  phone?: string | null
  firstName: string
  lastName: string
}): Promise<{ email: string; username: string; usedSyntheticEmail: boolean }> {
  const trimmedEmail = (input.email || '').trim().toLowerCase()
  const usedSyntheticEmail = !trimmedEmail
  const email = usedSyntheticEmail ? generateSyntheticTeacherEmail() : trimmedEmail

  const phoneUsername = input.phone ? normalizePhoneUsername(input.phone) : ''
  let candidate = phoneUsername || buildNameUsername(input.firstName, input.lastName)

  const username = await ensureUniqueUsername(candidate)
  return { email, username, usedSyntheticEmail }
}

async function ensureUniqueUsername(base: string): Promise<string> {
  let candidate = base
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: candidate, mode: 'insensitive' } },
          { email: { equals: candidate, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    })
    if (!existing) return candidate
    candidate = `${base}.${randomUUID().slice(0, 4)}`
  }
  return `${base}.${randomUUID().slice(0, 8)}`
}
