import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export const runtime = 'nodejs'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

type AuditLogEntry = {
  id: string
  project_id: string
  entity_type: string
  entity_id: string
  action: string
  actor_id: string
  metadata: Record<string, unknown> | null
  created_at: string
  user: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    role: string | null
  } | null
}

type AuditLogRow = {
  id: string
  project_id: string
  entity_type: string
  entity_id: string
  action: string
  actor_id: string
  metadata: Record<string, unknown> | null
  created_at: string
  profiles: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    role: string | null
  } | null
}

type PaginatedResponse = {
  data: AuditLogEntry[]
  meta: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

type ErrorResponse = {
  error: string
  message?: string
}

function parseIntParam(
  value: string | null,
  defaultVal: number,
  max?: number,
): number {
  if (!value) return defaultVal
  const parsed = parseInt(value, 10)
  if (isNaN(parsed) || parsed < 0) return defaultVal
  if (max !== undefined && parsed > max) return max
  return parsed
}

async function verifyAdminOrOwner(accessToken: string): Promise<boolean> {
  const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
  if (!API_URL) return false

  try {
    const response = await fetch(`${API_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) return false
    const data = (await response.json()) as { role?: string; roles?: string[] }
    const role = data.role ?? ''
    const roles: string[] = data.roles ?? (role ? [role] : [])
    return roles.some((r) =>
      ['admin', 'owner', 'ADMIN', 'OWNER'].includes(r),
    )
  } catch {
    return false
  }
}

async function fetchAuditLogs(
  accessToken: string,
  params: {
    project_id?: string
    entity_type?: string
    action?: string
    date_from?: string
    date_to?: string
    limit: number
    offset: number
  },
): Promise<{ data: AuditLogRow[]; total: number }> {
  const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
  if (!API_URL) throw new Error('API_URL is not configured')

  const query = new URLSearchParams()
  if (params.project_id) query.set('project_id', params.project_id)
  if (params.entity_type) query.set('entity_type', params.entity_type)
  if (params.action) query.set('action', params.action)
  if (params.date_from) query.set('date_from', params.date_from)
  if (params.date_to) query.set('date_to', params.date_to)
  query.set('limit', String(params.limit))
  query.set('offset', String(params.offset))

  const response = await fetch(
    `${API_URL}/audit-logs?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  )

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string
    }
    throw new Error(body.message ?? `Upstream error: ${response.status}`)
  }

  const json = (await response.json()) as {
    data?: AuditLogRow[]
    items?: AuditLogRow[]
    total?: number
    count?: number
  }

  const rows: AuditLogRow[] = json.data ?? json.items ?? []
  const total: number = json.total ?? json.count ?? rows.length

  return { data: rows, total }
}

function mapRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    project_id: row.project_id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    action: row.action,
    actor_id: row.actor_id,
    metadata: row.metadata,
    created_at: row.created_at,
    user: row.profiles
      ? {
          id: row.profiles.id,
          email: row.profiles.email,
          full_name: row.profiles.full_name,
          avatar_url: row.profiles.avatar_url,
          role: row.profiles.role,
        }
      : null,
  }
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<PaginatedResponse | ErrorResponse>> {
  // --- Auth: require valid session token ---
  const token = await getToken({
    req: request as Parameters<typeof getToken>[0]['req'],
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token?.accessToken) {
    return NextResponse.json<ErrorResponse>(
      { error: 'Unauthorized', message: 'Authentication required.' },
      { status: 401 },
    )
  }

  const accessToken = token.accessToken as string

  // --- Authz: admin or owner only ---
  const isAuthorized = await verifyAdminOrOwner(accessToken)
  if (!isAuthorized) {
    return NextResponse.json<ErrorResponse>(
      {
        error: 'Forbidden',
        message: 'You do not have permission to access audit logs.',
      },
      { status: 403 },
    )
  }

  // --- Parse query params ---
  const { searchParams } = request.nextUrl

  const project_id = searchParams.get('project_id') ?? undefined
  const entity_type = searchParams.get('entity_type') ?? undefined
  const action = searchParams.get('action') ?? undefined
  const date_from = searchParams.get('date_from') ?? undefined
  const date_to = searchParams.get('date_to') ?? undefined
  const limit = parseIntParam(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT)
  const offset = parseIntParam(searchParams.get('offset'), 0)

  // --- Validate date params if provided ---
  if (date_from && isNaN(Date.parse(date_from))) {
    return NextResponse.json<ErrorResponse>(
      { error: 'Bad Request', message: 'Invalid date_from format. Use ISO 8601.' },
      { status: 400 },
    )
  }
  if (date_to && isNaN(Date.parse(date_to))) {
    return NextResponse.json<ErrorResponse>(
      { error: 'Bad Request', message: 'Invalid date_to format. Use ISO 8601.' },
      { status: 400 },
    )
  }

  // --- Fetch from upstream API ---
  try {
    const { data: rows, total } = await fetchAuditLogs(accessToken, {
      project_id,
      entity_type,
      action,
      date_from,
      date_to,
      limit,
      offset,
    })

    const entries = rows.map(mapRow)

    return NextResponse.json<PaginatedResponse>(
      {
        data: entries,
        meta: {
          total,
          limit,
          offset,
          has_more: offset + entries.length < total,
        },
      },
      { status: 200 },
    )
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    console.error('[GET /api/audit]', err)
    return NextResponse.json<ErrorResponse>(
      { error: 'Internal Server Error', message },
      { status: 500 },
    )
  }
}
