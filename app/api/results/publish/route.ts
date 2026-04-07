import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasRole } from "@/lib/auth-utils"

// PATCH /api/results/publish - Publish results (Admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasRole(session.user.role, ['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { resultIds, term, year, published } = body

    if (resultIds && Array.isArray(resultIds)) {
      // Publish specific results
      await prisma.result.updateMany({
        where: {
          id: { in: resultIds },
          schoolId: session.user.schoolId || undefined,
        },
        data: {
          published: published !== false,
        },
      })

      return NextResponse.json({ success: true, count: resultIds.length })
    } else if (term && year) {
      // Publish all results for a term/year
      const result = await prisma.result.updateMany({
        where: {
          schoolId: session.user.schoolId || undefined,
          term,
          year: parseInt(year),
        },
        data: {
          published: published !== false,
        },
      })

      return NextResponse.json({ success: true, count: result.count })
    } else {
      return NextResponse.json(
        { error: 'Either resultIds or term/year required' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error publishing results:', error)
    return NextResponse.json(
      { error: 'Failed to publish results' },
      { status: 500 }
    )
  }
}

// Allow POST for backward compatibility with existing clients
export async function POST(request: NextRequest) {
  return PATCH(request)
}
