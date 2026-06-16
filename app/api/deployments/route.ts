The project doesn't have an App Router directory yet. I'll generate the file based on the existing patterns (next-auth JWT, pages router conventions adapted to App Router).

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Supabase client (server-side only)
// ---------------------------------------------------------------------------

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase environment variables are not configured')
  }

  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const CreateDeploymentSchema = z.object({
  project_id: z.string().uuid('project_id must be a valid UUID'),
  environment: z.enum(['development', 'staging', 'production'], {
    errorMap: () => ({
      message: 'environment must be one of: development, staging, production',
    }),
  }),
  version_number: z.string().optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

type CreateDeploymentInput = z.infer<typeof CreateDeploymentSchema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_ROLES = ['admin', 'owner'] as const

async function getAuthToken(req: NextRequest) {
  const isSecure =
    req.headers.get('x-forwarded-proto') === 'https' ||
    req.nextUrl.protocol === 'https:'

  return getToken({
    req: req as Parameters<typeof getToken>[0]['req'],
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isSecure,
    cookieName: isSecure
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token',
  })
}

async function checkProjectMember(
  supabase: ReturnType<typeof getSupabaseClient>,
  projectId: string,
  userId: string,
): Promise<{ isMember: boolean; role: string | null }> {
  const { data, error } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[deployments] checkProjectMember error:', error)
    return { isMember: false, role: null }
  }

  return { isMember: !!data, role: data?.role ?? null }
}

async function logAudit(
  supabase: ReturnType<typeof getSupabaseClient>,
  params: {
    action: string
    userId: string
    resourceType: string
    resourceId: string
    metadata?: Record<string, unknown>
  },
) {
  const { error } = await supabase.from('audit_logs').insert({
    action: params.action,
    user_id: params.userId,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    metadata: params.metadata ?? {},
    created_at: new Date().toISOString(),
  })

  if (error) {
    // Non-fatal — log but do not fail the request
    console.error('[deployments] audit log error:', error)
  }
}

// ---------------------------------------------------------------------------
// GET /api/deployments?project_id=&environment=&status=
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // Auth check
  const token = await getAuthToken(req)

  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const userId = token.sub ?? (token.id as string | undefined)

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const projectId = searchParams.get('project_id')
  const environment = searchParams.get('environment')
  const status = searchParams.get('status')

  if (!projectId) {
    return NextResponse.json(
      { message: 'project_id query parameter is required' },
      { status: 400 },
    )
  }

  let supabase: ReturnType<typeof getSupabaseClient>

  try {
    supabase = getSupabaseClient()
  } catch {
    return NextResponse.json(
      { message: 'Server configuration error' },
      { status: 500 },
    )
  }

  // Verify project membership
  const { isMember } = await checkProjectMember(supabase, projectId, userId)

  if (!isMember) {
    return NextResponse.json(
      { message: 'Forbidden: you are not a member of this project' },
      { status: 403 },
    )
  }

  // Build query
  let query = supabase
    .from('deployments')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (environment) {
    query = query.eq('environment', environment)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('[deployments] GET error:', error)
    return NextResponse.json(
      { message: 'Failed to fetch deployments' },
      { status: 500 },
    )
  }

  return NextResponse.json({ deployments: data }, { status: 200 })
}

// ---------------------------------------------------------------------------
// POST /api/deployments
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Auth check
  const token = await getAuthToken(req)

  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const userId = token.sub ?? (token.id as string | undefined)

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate
  const parsed = CreateDeploymentSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: 'Validation error',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const input: CreateDeploymentInput = parsed.data

  let supabase: ReturnType<typeof getSupabaseClient>

  try {
    supabase = getSupabaseClient()
  } catch {
    return NextResponse.json(
      { message: 'Server configuration error' },
      { status: 500 },
    )
  }

  // Verify project membership and role
  const { isMember, role } = await checkProjectMember(
    supabase,
    input.project_id,
    userId,
  )

  if (!isMember) {
    return NextResponse.json(
      { message: 'Forbidden: you are not a member of this project' },
      { status: 403 },
    )
  }

  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json(
      { message: 'Forbidden: only admins and owners can create deployments' },
      { status: 403 },
    )
  }

  // Resolve version_number
  let versionNumber = input.version_number

  if (!versionNumber) {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'generate_version_number',
      {
        p_project_id: input.project_id,
        p_environment: input.environment,
      },
    )

    if (rpcError || !rpcData) {
      console.error('[deployments] generate_version_number RPC error:', rpcError)
      return NextResponse.json(
        { message: 'Failed to generate version number' },
        { status: 500 },
      )
    }

    versionNumber = String(rpcData)
  }

  // Create deployment record
  const { data: deployment, error: insertError } = await supabase
    .from('deployments')
    .insert({
      project_id: input.project_id,
      environment: input.environment,
      version_number: versionNumber,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
      created_by: userId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertError || !deployment) {
    console.error('[deployments] insert error:', insertError)
    return NextResponse.json(
      { message: 'Failed to create deployment' },
      { status: 500 },
    )
  }

  // Audit log — non-blocking
  await logAudit(supabase, {
    action: 'deployment.created',
    userId,
    resourceType: 'deployment',
    resourceId: deployment.id as string,
    metadata: {
      project_id: input.project_id,
      environment: input.environment,
      version_number: versionNumber,
    },
  })

  return NextResponse.json({ deployment }, { status: 201 })
}
