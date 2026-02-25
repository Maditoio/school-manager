import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user || !session.user.schoolId) {
      return NextResponse.json(
        {
          suspended: false,
          reason: null,
          suspendedAt: null,
        },
        { status: 200 }
      )
    }

    const school = await prisma.school.findUnique({
      where: { id: session.user.schoolId },
      select: {
        suspended: true,
        suspensionReason: true,
        suspendedAt: true,
      },
    })

    if (!school) {
      return NextResponse.json(
        {
          suspended: false,
          reason: null,
          suspendedAt: null,
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      suspended: school.suspended,
      reason: school.suspensionReason,
      suspendedAt: school.suspendedAt,
    })
  } catch (error) {
    console.error('Error checking school suspension:', error)
    return NextResponse.json(
      {
        suspended: false,
        reason: null,
        suspendedAt: null,
      },
      { status: 200 }
    )
  }
}
