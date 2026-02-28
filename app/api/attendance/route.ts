import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { attendanceSchema } from "@/lib/validations"
import { hasRole } from "@/lib/auth-utils"
import {
  assertTermEditableById,
  CurrentTermNotSetError,
  getCurrentEditableTermForSchool,
  TermLockedError,
} from '@/lib/term-utils'

// GET /api/attendance - Get attendance records
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const classId = searchParams.get('classId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = {}

    // Filter by school for non-super admins
    if (session.user.schoolId) {
      where.schoolId = session.user.schoolId
    }

    // Filter by student
    if (studentId) {
      where.studentId = studentId
    }

    if (classId) {
      where.student = {
        classId,
      }
    }

    // Filter by date range
    if (startDate || endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {}
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) dateFilter.lte = new Date(endDate)
      where.date = dateFilter
    }

    // For parents, only show their children's attendance
    if (session.user.role === 'PARENT') {
      const students = await prisma.student.findMany({
        where: { parentId: session.user.id },
        select: { id: true },
      })
      where.studentId = { in: students.map(s => s.id) }
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            class: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ attendance })
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    )
  }
}

// POST /api/attendance - Mark attendance (supports batch)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Support batch attendance marking
    if (body.records && Array.isArray(body.records)) {
      const attendanceRecords = []
      const currentTermBySchool = new Map<string, Awaited<ReturnType<typeof getCurrentEditableTermForSchool>>>()
      
      for (const record of body.records) {
        const student = await prisma.student.findUnique({
          where: { id: record.studentId },
        })

        if (!student) {
          continue // Skip invalid students
        }

        if (session.user.schoolId && student.schoolId !== session.user.schoolId) {
          continue // Skip students from other schools
        }

        const attendanceDate = new Date(record.date)
        const existing = await prisma.attendance.findUnique({
          where: {
            studentId_date: {
              studentId: record.studentId,
              date: attendanceDate,
            },
          },
          select: {
            id: true,
            termId: true,
            schoolId: true,
          },
        })

        if (existing) {
          await assertTermEditableById({ schoolId: existing.schoolId, termId: existing.termId })
        }

        let currentTerm = currentTermBySchool.get(student.schoolId)
        if (!currentTerm) {
          currentTerm = await getCurrentEditableTermForSchool(student.schoolId)
          currentTermBySchool.set(student.schoolId, currentTerm)
        }

        const attendance = await prisma.attendance.upsert({
          where: {
            studentId_date: {
              studentId: record.studentId,
              date: attendanceDate,
            },
          },
          update: {
            status: record.status,
            notes: record.notes,
          },
          create: {
            schoolId: student.schoolId,
            studentId: record.studentId,
            termId: currentTerm.id,
            date: attendanceDate,
            status: record.status,
            notes: record.notes,
          },
        })
        
        attendanceRecords.push(attendance)
      }

      return NextResponse.json({ 
        attendance: attendanceRecords,
        count: attendanceRecords.length 
      }, { status: 201 })
    }

    // Single attendance record
    const validation = attendanceSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { studentId, date, status, notes } = validation.data

    // Verify student belongs to school
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    if (session.user.schoolId && student.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Upsert attendance record
    const attendanceDate = new Date(date)
    const existing = await prisma.attendance.findUnique({
      where: {
        studentId_date: {
          studentId,
          date: attendanceDate,
        },
      },
      select: {
        id: true,
        termId: true,
        schoolId: true,
      },
    })

    if (existing) {
      await assertTermEditableById({ schoolId: existing.schoolId, termId: existing.termId })
    }

    const currentTerm = await getCurrentEditableTermForSchool(student.schoolId)

    const attendance = await prisma.attendance.upsert({
      where: {
        studentId_date: {
          studentId,
          date: attendanceDate,
        },
      },
      update: {
        status,
        notes,
      },
      create: {
        schoolId: student.schoolId,
        studentId,
        termId: currentTerm.id,
        date: attendanceDate,
        status,
        notes,
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json({ attendance }, { status: 201 })
  } catch (error) {
    console.error('Error marking attendance:', error)
    if (error instanceof CurrentTermNotSetError || error instanceof TermLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(
      { error: 'Failed to mark attendance' },
      { status: 500 }
    )
  }
}
