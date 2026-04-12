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
      minimumPassRatePerSubject: settings?.minimumPassRatePerSubject ?? 50,
      feeGracePeriodDays: settings?.feeGracePeriodDays ?? 0,
      currency: settings?.currency ?? 'ZAR',
      logoUrl: settings?.logoUrl ?? null,
      reportTemplate: settings?.reportTemplate ?? 1,
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
    const updateData: {
      expenseApprovalThreshold?: number
      minimumPassRatePerSubject?: number
      feeGracePeriodDays?: number
      currency?: string
      logoUrl?: string | null
      reportTemplate?: number
    } = {}

    if (body.expenseApprovalThreshold !== undefined) {
      const threshold = Number(body.expenseApprovalThreshold)
      if (isNaN(threshold) || threshold < 0) {
        return NextResponse.json({ error: 'Threshold must be a non-negative number' }, { status: 400 })
      }
      updateData.expenseApprovalThreshold = threshold
    }

    if (body.minimumPassRatePerSubject !== undefined) {
      const passRate = Number(body.minimumPassRatePerSubject)
      if (isNaN(passRate) || passRate < 0 || passRate > 100) {
        return NextResponse.json({ error: 'Minimum pass rate must be between 0 and 100' }, { status: 400 })
      }
      updateData.minimumPassRatePerSubject = passRate
    }

    if (body.feeGracePeriodDays !== undefined) {
      const grace = Number(body.feeGracePeriodDays)
      if (!Number.isInteger(grace) || grace < 0 || grace > 365) {
        return NextResponse.json({ error: 'Grace period must be an integer between 0 and 365 days' }, { status: 400 })
      }
      updateData.feeGracePeriodDays = grace
    }

    if (body.currency !== undefined) {
      if (!VALID_CURRENCIES.includes(body.currency)) {
        return NextResponse.json({ error: 'Invalid currency. Must be one of: USD, ZAR, FCFA, CDF' }, { status: 400 })
      }
      updateData.currency = body.currency
    }

    if (body.logoUrl !== undefined) {
      // Only accept empty string (clear) or https:// URLs (Vercel Blob URLs)
      const val = body.logoUrl as string
      if (val !== '' && !/^https?:\/\//i.test(val)) {
        return NextResponse.json({ error: 'logoUrl must be a valid https URL' }, { status: 400 })
      }
      updateData.logoUrl = val === '' ? null : val
    }

    if (body.reportTemplate !== undefined) {
      const tpl = Number(body.reportTemplate)
      if (!Number.isInteger(tpl) || tpl < 1 || tpl > 11) {
        return NextResponse.json({ error: 'reportTemplate must be an integer 1–11' }, { status: 400 })
      }
      updateData.reportTemplate = tpl
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
      minimumPassRatePerSubject: settings.minimumPassRatePerSubject,
      feeGracePeriodDays: settings.feeGracePeriodDays,
      currency: settings.currency,
      logoUrl: settings.logoUrl ?? null,
      reportTemplate: settings.reportTemplate,
    })
  } catch (error) {
    console.error('Error updating school settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
