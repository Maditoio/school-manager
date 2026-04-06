import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

async function resolveSchoolId(sessionUser: { id?: string | null; email?: string | null; schoolId?: string | null; role?: string | null }) {
  if (sessionUser.schoolId) return sessionUser.schoolId

  if (!sessionUser.email) return null

  const user = await prisma.user.findUnique({
    where: { email: sessionUser.email.toLowerCase() },
    select: { schoolId: true },
  })
  return user?.schoolId ?? null
}

const VALID_CURRENCIES = ['USD', 'ZAR', 'FCFA', 'CDF'] as const

// GET /api/schools/settings — fetch school settings (all staff roles)
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE', 'FINANCE_MANAGER', 'TEACHER'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schoolId = await resolveSchoolId(session.user)
    if (!schoolId) return NextResponse.json({ error: 'School not found' }, { status: 400 })

    const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } })

    return NextResponse.json({
      expenseApprovalThreshold: settings?.expenseApprovalThreshold ?? 0,
      currency: settings?.currency ?? 'ZAR',
    })
  } catch (error) {
    console.error('Error fetching school settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

// PATCH /api/schools/settings — update settings (SCHOOL_ADMIN only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ error: 'Only school administrators can update settings' }, { status: 403 })
    }

    const schoolId = await resolveSchoolId(session.user)
    if (!schoolId) return NextResponse.json({ error: 'School not found' }, { status: 400 })

    const body = await request.json()
    const updateData: { expenseApprovalThreshold?: number; currency?: string } = {}

    if (body.expenseApprovalThreshold !== undefined) {
      const threshold = Number(body.expenseApprovalThreshold)
      if (isNaN(threshold) || threshold < 0) {
        return NextResponse.json({ error: 'Threshold must be a non-negative number' }, { status: 400 })
      }
      updateData.expenseApprovalThreshold = threshold
    }

    if (body.currency !== undefined) {
      if (!VALID_CURRENCIES.includes(body.currency)) {
        return NextResponse.json({ error: 'Invalid currency. Must be one of: USD, ZAR, FCFA, CDF' }, { status: 400 })
      }
      updateData.currency = body.currency
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const settings = await prisma.schoolSettings.upsert({
      where: { schoolId },
      update: updateData,
      create: { schoolId, expenseApprovalThreshold: 0, currency: 'ZAR', ...updateData },
    })

    return NextResponse.json({
      expenseApprovalThreshold: settings.expenseApprovalThreshold,
      currency: settings.currency,
    })
  } catch (error) {
    console.error('Error updating school settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
