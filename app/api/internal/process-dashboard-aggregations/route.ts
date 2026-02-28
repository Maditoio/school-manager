import { NextRequest, NextResponse } from 'next/server'
import { processAcademicAggregationEvents } from '@/lib/academic-aggregation'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const acceptedTokens = [process.env.INTERNAL_API_TOKEN, process.env.CRON_SECRET].filter(
      (value): value is string => typeof value === 'string' && value.length > 0
    )

    if (
      acceptedTokens.length > 0 &&
      !acceptedTokens.some((token) => authHeader === `Bearer ${token}`)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await processAcademicAggregationEvents(50)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error processing dashboard aggregation events:', error)
    return NextResponse.json(
      { error: 'Failed to process dashboard aggregation events' },
      { status: 500 }
    )
  }
}
