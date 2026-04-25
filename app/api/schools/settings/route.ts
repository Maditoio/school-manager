import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { isMissingVideoCoursesEnabledColumn } from '@/lib/video-courses-feature'

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

    let settings: {
      expenseApprovalThreshold: number
      minimumPassRatePerSubject: number
      currency: string
      logoUrl: string | null
      reportTemplate: number
      autoInvoiceEnabled: boolean
      invoiceDayOfMonth: number
      feesDueDayOfMonth: number
      invoiceActiveMonths: number[]
      allowCrossSchoolCourses: boolean
      videoCoursesEnabled?: boolean
    } | null

    try {
      settings = await prisma.schoolSettings.findUnique({
        where: { schoolId },
        select: {
          expenseApprovalThreshold: true,
          minimumPassRatePerSubject: true,
          currency: true,
          logoUrl: true,
          reportTemplate: true,
          autoInvoiceEnabled: true,
          invoiceDayOfMonth: true,
          feesDueDayOfMonth: true,
          invoiceActiveMonths: true,
          allowCrossSchoolCourses: true,
          videoCoursesEnabled: true,
        },
      })
    } catch (error) {
      if (!isMissingVideoCoursesEnabledColumn(error)) throw error

      settings = await prisma.schoolSettings.findUnique({
        where: { schoolId },
        select: {
          expenseApprovalThreshold: true,
          minimumPassRatePerSubject: true,
          currency: true,
          logoUrl: true,
          reportTemplate: true,
          autoInvoiceEnabled: true,
          invoiceDayOfMonth: true,
          feesDueDayOfMonth: true,
          invoiceActiveMonths: true,
          allowCrossSchoolCourses: true,
        },
      })
    }

    return NextResponse.json({
      expenseApprovalThreshold: settings?.expenseApprovalThreshold ?? 0,
      minimumPassRatePerSubject: settings?.minimumPassRatePerSubject ?? 50,
      currency: settings?.currency ?? 'ZAR',
      logoUrl: settings?.logoUrl ?? null,
      reportTemplate: settings?.reportTemplate ?? 1,
      autoInvoiceEnabled: settings?.autoInvoiceEnabled ?? false,
      invoiceDayOfMonth: settings?.invoiceDayOfMonth ?? 1,
      feesDueDayOfMonth: settings?.feesDueDayOfMonth ?? 15,
      invoiceActiveMonths: settings?.invoiceActiveMonths ?? [],
      allowCrossSchoolCourses: settings?.allowCrossSchoolCourses ?? false,
      videoCoursesEnabled: settings?.videoCoursesEnabled ?? true,
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
      currency?: string
      logoUrl?: string | null
      reportTemplate?: number
      autoInvoiceEnabled?: boolean
      invoiceDayOfMonth?: number
      feesDueDayOfMonth?: number
      invoiceActiveMonths?: number[]
      videoCoursesEnabled?: boolean
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

    if (body.autoInvoiceEnabled !== undefined) {
      updateData.autoInvoiceEnabled = Boolean(body.autoInvoiceEnabled)
    }

    if (body.allowCrossSchoolCourses !== undefined) {
      (updateData as Record<string, unknown>).allowCrossSchoolCourses = Boolean(body.allowCrossSchoolCourses)
    }

    if (body.videoCoursesEnabled !== undefined) {
      updateData.videoCoursesEnabled = Boolean(body.videoCoursesEnabled)
    }

    if (body.invoiceDayOfMonth !== undefined) {
      const d = Number(body.invoiceDayOfMonth)
      if (!Number.isInteger(d) || d < 1 || d > 28) {
        return NextResponse.json({ error: 'invoiceDayOfMonth must be 1–28' }, { status: 400 })
      }
      updateData.invoiceDayOfMonth = d
    }

    if (body.feesDueDayOfMonth !== undefined) {
      const d = Number(body.feesDueDayOfMonth)
      if (!Number.isInteger(d) || d < 1 || d > 28) {
        return NextResponse.json({ error: 'feesDueDayOfMonth must be 1–28' }, { status: 400 })
      }
      updateData.feesDueDayOfMonth = d
    }

    if (body.invoiceActiveMonths !== undefined) {
      if (!Array.isArray(body.invoiceActiveMonths)) {
        return NextResponse.json({ error: 'invoiceActiveMonths must be an array' }, { status: 400 })
      }
      const months = body.invoiceActiveMonths as number[]
      if (months.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) {
        return NextResponse.json({ error: 'invoiceActiveMonths values must be 1–12' }, { status: 400 })
      }
      updateData.invoiceActiveMonths = months
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    let settings
    try {
      settings = await prisma.schoolSettings.upsert({
        where: { schoolId },
        update: updateData,
        create: { schoolId, expenseApprovalThreshold: 0, currency: 'ZAR', ...updateData },
      })
    } catch (error) {
      if (!isMissingVideoCoursesEnabledColumn(error)) throw error

      const { videoCoursesEnabled, ...legacyUpdateData } = updateData

      settings = await prisma.schoolSettings.upsert({
        where: { schoolId },
        update: legacyUpdateData,
        create: { schoolId, expenseApprovalThreshold: 0, currency: 'ZAR', ...legacyUpdateData },
      })
    }

    return NextResponse.json({
      expenseApprovalThreshold: settings.expenseApprovalThreshold,
      minimumPassRatePerSubject: settings.minimumPassRatePerSubject,
      currency: settings.currency,
      logoUrl: settings.logoUrl ?? null,
      reportTemplate: settings.reportTemplate,
      autoInvoiceEnabled: settings.autoInvoiceEnabled,
      invoiceDayOfMonth: settings.invoiceDayOfMonth,
      feesDueDayOfMonth: settings.feesDueDayOfMonth,
      invoiceActiveMonths: settings.invoiceActiveMonths,
      allowCrossSchoolCourses: (settings as Record<string, unknown>).allowCrossSchoolCourses ?? false,
      videoCoursesEnabled: (settings as Record<string, unknown>).videoCoursesEnabled ?? true,
    })
  } catch (error) {
    console.error('Error updating school settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
