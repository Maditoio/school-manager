import { NextRequest, NextResponse } from "next/server"
import { executeScheduledDeletions } from "@/lib/scheduled-deletions"

// GET /api/internal/execute-scheduled-deletions - Internal endpoint to execute scheduled deletions
// This can be called by a cron job (e.g., once daily) to execute any pending deletions that have passed their scheduled time
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authentication if needed for security
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.INTERNAL_API_TOKEN

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const result = await executeScheduledDeletions()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error executing scheduled deletions:', error)
    return NextResponse.json(
      { error: 'Failed to execute scheduled deletions' },
      { status: 500 }
    )
  }
}
