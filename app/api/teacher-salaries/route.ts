import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'FINANCE_MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') ? Number(searchParams.get('month')) : undefined
    const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined
    const teacherId = searchParams.get('teacherId') ?? undefined

    const salaries = await prisma.teacherSalary.findMany({
      where: {
        schoolId: session.user.schoolId!,
        ...(month !== undefined && { month }),
        ...(year !== undefined && { year }),
        ...(teacherId && { teacherId }),
      },
      include: {
        teacher: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        recordedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { teacher: { firstName: 'asc' } }],
    })

    // Also return the list of teachers in this school
    const teachers = await prisma.user.findMany({
      where: { schoolId: session.user.schoolId!, role: 'TEACHER' },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })

    return NextResponse.json({ salaries, teachers })
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
    const teacherId = typeof body.teacherId === 'string' ? body.teacherId : ''
    const amount = Number(body.amount)
    const month = Number(body.month)
    const year = Number(body.year)
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null

    if (!teacherId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'teacherId and a positive amount are required' }, { status: 400 })
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'month must be 1–12' }, { status: 400 })
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
    }

    // Verify the teacher belongs to this school
    const teacher = await prisma.user.findFirst({
      where: { id: teacherId, schoolId: session.user.schoolId!, role: 'TEACHER' },
      select: { id: true },
    })
    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
    }

    const salary = await prisma.teacherSalary.upsert({
      where: { teacherId_month_year: { teacherId, month, year } },
      create: {
        schoolId: session.user.schoolId!,
        teacherId,
        amount,
        month,
        year,
        notes,
        recordedBy: session.user.id,
      },
      update: {
        amount,
        notes,
        recordedBy: session.user.id,
        status: 'PENDING',
        paidAt: null,
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    return NextResponse.json({ salary }, { status: 201 })
  } catch (error) {
    console.error('Error creating teacher salary:', error)
    return NextResponse.json({ error: 'Failed to save salary' }, { status: 500 })
  }
}
