import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !['FINANCE_MANAGER', 'TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') ? Number(searchParams.get('month')) : undefined
    const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined
    const teacherIdParam = searchParams.get('teacherId') ?? undefined
    // ?meta=1 skips the salary query and only returns teachers + configs (for initial page load)
    const metaOnly = searchParams.get('meta') === '1'

    const isTeacher = session.user.role === 'TEACHER'
    const teacherScopeId = isTeacher ? session.user.id : teacherIdParam

    const [teachers, configs] = await Promise.all([
      isTeacher
        ? prisma.user.findMany({
            where: { id: session.user.id, schoolId: session.user.schoolId!, role: 'TEACHER' },
            select: { id: true, firstName: true, lastName: true, email: true },
            orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
          })
        : prisma.user.findMany({
            where: { schoolId: session.user.schoolId!, role: 'TEACHER' },
            select: { id: true, firstName: true, lastName: true, email: true },
            orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
          }),
      prisma.teacherSalaryConfig.findMany({
        where: { schoolId: session.user.schoolId! },
        select: { teacherId: true, baseAmount: true, notes: true },
      }),
    ])

    if (metaOnly) {
      return NextResponse.json({ salaries: [], teachers, configs })
    }

    const salaries = await prisma.teacherSalary.findMany({
      where: {
        schoolId: session.user.schoolId!,
        ...(month !== undefined && { month }),
        ...(year !== undefined && { year }),
        ...(teacherScopeId && { teacherId: teacherScopeId }),
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        recordedByUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { teacher: { firstName: 'asc' } }],
    })

    return NextResponse.json({ salaries, teachers, configs })
  } catch (error) {
    console.error('Error fetching teacher salaries:', error)
    return NextResponse.json({ error: 'Failed to fetch salaries' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'FINANCE_MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // ── Bulk generate salary records from base salary configs ─────────────
    if (body.action === 'generate') {
      const month = Number(body.month)
      const year = Number(body.year)
      if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
        return NextResponse.json({ error: 'Invalid month/year' }, { status: 400 })
      }

      const configs = await prisma.teacherSalaryConfig.findMany({
        where: { schoolId: session.user.schoolId! },
        select: { teacherId: true, baseAmount: true },
      })

      if (configs.length === 0) {
        return NextResponse.json(
          { error: 'No base salaries configured. Set a base salary for each teacher first.' },
          { status: 400 }
        )
      }

      // Skip teachers that already have a record this month/year
      const existing = await prisma.teacherSalary.findMany({
        where: { schoolId: session.user.schoolId!, month, year },
        select: { teacherId: true },
      })
      const existingIds = new Set(existing.map(e => e.teacherId))
      const toCreate = configs.filter(c => !existingIds.has(c.teacherId))

      if (toCreate.length === 0) {
        return NextResponse.json({ message: 'All configured teachers already have records for this period.', generated: 0 })
      }

      await prisma.teacherSalary.createMany({
        data: toCreate.map(c => ({
          schoolId: session.user.schoolId!,
          teacherId: c.teacherId,
          amount: c.baseAmount,
          month,
          year,
          recordedBy: session.user.id,
        })),
        skipDuplicates: true,
      })

      return NextResponse.json({ generated: toCreate.length })
    }

    // ── Set / update a teacher's base salary config ───────────────────────
    if (body.action === 'setBase') {
      const teacherId = typeof body.teacherId === 'string' ? body.teacherId.trim() : ''
      const baseAmount = Number(body.baseAmount)
      if (!teacherId || !Number.isFinite(baseAmount) || baseAmount <= 0) {
        return NextResponse.json({ error: 'teacherId and a positive baseAmount are required' }, { status: 400 })
      }

      const teacher = await prisma.user.findFirst({
        where: { id: teacherId, schoolId: session.user.schoolId!, role: 'TEACHER' },
        select: { id: true },
      })
      if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })

      const config = await prisma.teacherSalaryConfig.upsert({
        where: { teacherId },
        create: {
          schoolId: session.user.schoolId!,
          teacherId,
          baseAmount,
          notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
          updatedBy: session.user.id,
        },
        update: {
          baseAmount,
          notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
          updatedBy: session.user.id,
        },
      })
      return NextResponse.json({ config })
    }

    // ── Create / update a single salary record ────────────────────────────
    const teacherId = typeof body.teacherId === 'string' ? body.teacherId.trim() : ''
    const amount = Number(body.amount)
    const paidAmountInput = body.paidAmount !== undefined ? Number(body.paidAmount) : 0
    const month = Number(body.month)
    const year = Number(body.year)
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : null

    if (!teacherId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'teacherId and a positive amount are required' }, { status: 400 })
    }
    if (!Number.isFinite(paidAmountInput) || paidAmountInput < 0) {
      return NextResponse.json({ error: 'paidAmount must be a non-negative number' }, { status: 400 })
    }
    if (paidAmountInput > amount) {
      return NextResponse.json({ error: 'paidAmount cannot be greater than salary amount' }, { status: 400 })
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'month must be 1–12' }, { status: 400 })
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
    }
    if (paymentDate && isNaN(paymentDate.getTime())) {
      return NextResponse.json({ error: 'Invalid payment date' }, { status: 400 })
    }

    const teacher = await prisma.user.findFirst({
      where: { id: teacherId, schoolId: session.user.schoolId!, role: 'TEACHER' },
      select: { id: true },
    })
    if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })

    const salaryStatus = paidAmountInput >= amount ? 'PAID' : 'PENDING'

    const salary = await prisma.teacherSalary.upsert({
      where: { teacherId_month_year: { teacherId, month, year } },
      create: {
        schoolId: session.user.schoolId!,
        teacherId,
        amount,
        paidAmount: paidAmountInput,
        month,
        year,
        paymentDate,
        status: salaryStatus,
        paidAt: salaryStatus === 'PAID' ? new Date() : null,
        notes,
        recordedBy: session.user.id,
      },
      update: {
        amount,
        paidAmount: paidAmountInput,
        paymentDate,
        notes,
        recordedBy: session.user.id,
        status: salaryStatus,
        paidAt: salaryStatus === 'PAID' ? new Date() : null,
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    return NextResponse.json({ salary }, { status: 201 })
  } catch (error) {
    console.error('Error saving teacher salary:', error)
    return NextResponse.json({ error: 'Failed to save salary' }, { status: 500 })
  }
}
