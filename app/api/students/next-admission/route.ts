import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'

function getNextAdmissionCode(existingAdmissionNumbers: Array<{ admissionNumber: string | null }>, academicYear: number) {
  const pattern = new RegExp(`^ADM-${academicYear}-(\\d{4})$`)
  const usedCodes = new Set<string>()

  for (const row of existingAdmissionNumbers) {
    const value = row.admissionNumber || ''
    const match = value.match(pattern)
    if (match?.[1]) {
      usedCodes.add(match[1])
    }
  }

  for (let code = 0; code < 10000; code += 1) {
    const padded = String(code).padStart(4, '0')
    if (!usedCodes.has(padded)) {
      return padded
    }
  }

  return null
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const classId = request.nextUrl.searchParams.get('classId')
    if (!classId) {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 })
    }

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true, academicYear: true },
    })

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    if (session.user.schoolId && classData.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const prefix = `ADM-${classData.academicYear}-`
    const existingAdmissionNumbers = await prisma.student.findMany({
      where: {
        schoolId: classData.schoolId,
        academicYear: classData.academicYear,
        admissionNumber: {
          startsWith: prefix,
        },
      },
      select: { admissionNumber: true },
    })

    const nextCode = getNextAdmissionCode(existingAdmissionNumbers, classData.academicYear)
    if (!nextCode) {
      return NextResponse.json(
        { error: `Admission number space exhausted for academic year ${classData.academicYear}` },
        { status: 409 }
      )
    }

    return NextResponse.json({
      admissionNumber: `${prefix}${nextCode}`,
      academicYear: classData.academicYear,
    })
  } catch (error) {
    console.error('Error generating next admission number:', error)
    return NextResponse.json({ error: 'Failed to generate next admission number' }, { status: 500 })
  }
}
