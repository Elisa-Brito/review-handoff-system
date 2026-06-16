Now I have enough context. The project uses Next.js Pages Router, but the task explicitly requests an App Router route at `app/api/deployments/[id]/route.ts`. I'll generate it with proper App Router conventions and patterns consistent with this TypeScript/Zod codebase.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth/next'

const UpdateDeploymentSchema = z.object({
  status: z
    .enum(['pending', 'building', 'ready', 'failed', 'cancelled'])
    .optional(),
  vercel_url: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type UpdateDeploymentInput = z.infer<typeof UpdateDeploymentSchema>

interface Screen {
  id: string
  deployment_id: string
  name: string
  path: string
  screenshot_url: string | null
  created_at: string
  updated_at: string
  comment_count: number
}

interface Deployment {
  id: string
  project_id: string
  status: string
  vercel_url: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  created_by: string
  screens: Screen[]
}

function getDeploymentBaseUrl(): string {
  return (
    process.env.DEPLOYMENTS_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:8000'
  )
}

function getInternalApiKey(): string | undefined {
  return process.env.INTERNAL_API_KEY
}

async function fetchDeployment(id: string, accessToken?: string): Promise<Deployment | null> {
  const baseUrl = getDeploymentBaseUrl()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const apiKey = getInternalApiKey()
  if (apiKey) {
    headers['X-Internal-Api-Key'] = apiKey
  }

  const response = await fetch(`${baseUrl}/api/deployments/${id}?include_screens=true&include_comment_counts=true`, {
    method: 'GET',
    headers,
    next: { revalidate: 0 },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Upstream error ${response.status}: ${response.statusText}`)
  }

  const json = await response.json()
  return (json.data ?? json) as Deployment
}

async function patchDeployment(
  id: string,
  payload: UpdateDeploymentInput,
  accessToken?: string,
): Promise<Deployment> {
  const baseUrl = getDeploymentBaseUrl()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const apiKey = getInternalApiKey()
  if (apiKey) {
    headers['X-Internal-Api-Key'] = apiKey
  }

  const response = await fetch(`${baseUrl}/api/deployments/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message =
      body?.message ?? body?.detail ?? body?.title ?? `Upstream error ${response.status}`
    const err = new Error(message) as Error & { status: number }
    err.status = response.status
    throw err
  }

  const json = await response.json()
  return (json.data ?? json) as Deployment
}

// ---------------------------------------------------------------------------
// GET /api/deployments/[id]
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ message: 'Invalid deployment id' }, { status: 400 })
  }

  try {
    const session = await getServerSession()
    const accessToken = (session as { accessToken?: string } | null)?.accessToken

    const deployment = await fetchDeployment(id, accessToken)

    if (!deployment) {
      return NextResponse.json(
        { message: 'Deployment not found' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      data: deployment,
      success: true,
      message: 'Deployment retrieved successfully',
    })
  } catch (err: unknown) {
    console.error('[GET /api/deployments/[id]] Unexpected error:', err)
    return NextResponse.json(
      { message: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/deployments/[id]
// ---------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ message: 'Invalid deployment id' }, { status: 400 })
  }

  // Auth check — must be signed in
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const accessToken = (session as { accessToken?: string }).accessToken

  // Parse and validate body
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UpdateDeploymentSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: 'Validation failed',
        _errors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  // Reject empty patch
  const payload = parsed.data
  if (Object.keys(payload).length === 0) {
    return NextResponse.json(
      { message: 'At least one field must be provided' },
      { status: 400 },
    )
  }

  try {
    const updated = await patchDeployment(id, payload, accessToken)

    return NextResponse.json({
      data: updated,
      success: true,
      message: 'Deployment updated successfully',
    })
  } catch (err: unknown) {
    const apiErr = err as Error & { status?: number }

    if (apiErr.status === 403 || apiErr.status === 401) {
      return NextResponse.json(
        { message: 'Forbidden: admin or owner access required' },
        { status: 403 },
      )
    }

    if (apiErr.status === 404) {
      return NextResponse.json(
        { message: 'Deployment not found' },
        { status: 404 },
      )
    }

    if (apiErr.status && apiErr.status >= 400 && apiErr.status < 500) {
      return NextResponse.json(
        { message: apiErr.message ?? 'Bad request' },
        { status: apiErr.status },
      )
    }

    console.error('[PATCH /api/deployments/[id]] Unexpected error:', err)
    return NextResponse.json(
      { message: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
