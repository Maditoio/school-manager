import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/auth-utils'
import { getStudentLicenseCoverageSnapshot } from '@/lib/student-licenses'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'FINANCE', 'FINANCE_MANAGER'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schoolId = session.user.schoolId
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID required' }, { status: 400 })
    }

    const snapshot = await getStudentLicenseCoverageSnapshot(schoolId)
    const activeStudents = await prisma.student.findMany({
      where: { schoolId, status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        classId: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })

    const classIds = Array.from(new Set(activeStudents.map((student) => student.classId).filter(Boolean)))
    const classes = classIds.length
      ? await prisma.class.findMany({
          where: { schoolId, id: { in: classIds as string[] } },
          select: { id: true, name: true },
        })
      : []
    const classNameById = new Map(classes.map((cls) => [cls.id, cls.name]))

    const students = activeStudents.map((student) => {
      const coverage = snapshot.licenseByStudentId.get(student.id)
      const paidAmount = Number((snapshot.paymentTotalsByStudentId.get(student.id) ?? 0).toFixed(2))
      const covered = Boolean(coverage)

      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        admissionNumber: student.admissionNumber,
        className: classNameById.get(student.classId) ?? '-',
        covered,
        coverageSource: coverage?.source ?? null,
        paidAmount,
        amountRequiredToCover: covered ? 0 : Number(snapshot.requiredAmountPerStudent.toFixed(2)),
      }
    })

    const studentsNotCovered = students.filter((student) => !student.covered)

    return NextResponse.json({
      summary: {
        licenseYear: snapshot.licenseYear,
        activeStudents: snapshot.activeStudents,
        coveredStudents: snapshot.coveredStudents,
        notCoveredStudents: snapshot.uncoveredStudents,
        bulkSeatsPurchased: snapshot.bulkLicensedStudentCount,
        coveredByBulk: snapshot.bulkCoveredStudents,
        coveredByExtraPayments: snapshot.extraCoveredStudents,
        annualPricePerStudent: snapshot.requiredAmountPerStudent,
        costToCoverAllUncovered: snapshot.extraLicenseCost,
      },
      consequences: [
        'Students not covered are blocked from announcements.',
        'Students not covered are blocked from attendance views.',
        'Students not covered are blocked from results views.',
        'Student report card generation is blocked until coverage is restored.',
      ],
      students,
      studentsNotCovered,
    })
  } catch (error) {
    console.error('Failed to fetch license overview:', error)
    return NextResponse.json({ error: 'Failed to fetch license overview' }, { status: 500 })
  }
}