import { env } from 'process'

const stripeApiBase = 'https://api.stripe.com/v1'

function getStripeKey() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable')
  }
  return key
}

async function stripeRequest(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>) {
  const apiKey = getStripeKey()

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  const searchParams = new URLSearchParams()
  if (body) {
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined || value === null) continue
      if (typeof value === 'object' && !Array.isArray(value)) {
        for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
          if (nestedValue !== undefined && nestedValue !== null) {
            searchParams.append(`${key}[${nestedKey}]`, String(nestedValue))
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach((item) => searchParams.append(`${key}[]`, String(item)))
      } else {
        searchParams.append(key, String(value))
      }
    }
  }

  const response = await fetch(`${stripeApiBase}${path}`, {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : searchParams.toString(),
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(`Stripe API error: ${json.error?.message || response.statusText}`)
  }
  return json
}

export async function createStripeCheckoutSession(args: {
  courseId: string
  courseTitle: string
  courseDescription: string | null
  amountCents: number
  currency: string
  successUrl: string
  cancelUrl: string
  studentId: string
}) {
  return stripeRequest('/checkout/sessions', 'POST', {
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: args.currency.toLowerCase(),
        product_data: {
          name: args.courseTitle,
          description: args.courseDescription ?? undefined,
        },
        unit_amount: args.amountCents,
      },
      quantity: 1,
    }],
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    metadata: {
      courseId: args.courseId,
      studentId: args.studentId,
    },
  })
}

export async function retrieveStripeCheckoutSession(sessionId: string) {
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`, 'GET')
}
