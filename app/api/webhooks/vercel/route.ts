import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const VercelWebhookSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('deployment.created'),
    payload: z.object({
      deployment: z.object({
        id: z.string(),
        name: z.string(),
        url: z.string().optional(),
        meta: z.record(z.unknown()).optional(),
      }),
    }),
  }),
  z.object({
    type: z.literal('deployment.ready'),
    payload: z.object({
      deployment: z.object({
        id: z.string(),
        name: z.string(),
        url: z.string(),
        meta: z.record(z.unknown()).optional(),
      }),
    }),
  }),
  z.object({
    type: z.literal('deployment.error'),
    payload: z.object({
      deployment: z.object({
        id: z.string(),
        name: z.string(),
        url: z.string().optional(),
        meta: z.record(z.unknown()).optional(),
      }),
    }),
  }),
])

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text()
  const sig = request.headers.get('x-vercel-signature')
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const hmac = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')

  if (sig !== hmac) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let rawPayload: unknown
  try {
    rawPayload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = VercelWebhookSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid webhook payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const event = parsed.data
  const supabase = createServiceClient()

  if (event.type === 'deployment.created') {
    const { deployment } = event.payload
    const { error } = await supabase.from('deployments').insert({
      vercel_deployment_id: deployment.id,
      name: deployment.name,
      status: 'created',
      vercel_url: deployment.url ?? null,
      meta: deployment.meta ?? null,
    })

    if (error) {
      console.error('Failed to create deployment record:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
  } else if (event.type === 'deployment.ready') {
    const { deployment } = event.payload
    const { error } = await supabase
      .from('deployments')
      .update({ status: 'ready', vercel_url: deployment.url })
      .eq('vercel_deployment_id', deployment.id)

    if (error) {
      console.error('Failed to update deployment to ready:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
  } else if (event.type === 'deployment.error') {
    const { deployment } = event.payload
    const { error } = await supabase
      .from('deployments')
      .update({ status: 'error' })
      .eq('vercel_deployment_id', deployment.id)

    if (error) {
      console.error('Failed to update deployment to error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
