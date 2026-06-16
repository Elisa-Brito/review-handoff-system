import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const GetHandoffsQuerySchema = z.object({
  project_id: z.string().uuid().optional(),
  screen_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

const UserStorySchema = z.object({
  as_a: z.string().min(1),
  i_want: z.string().min(1),
  so_that: z.string().min(1),
})

const AcceptanceCriterionSchema = z.object({
  description: z.string().min(1),
  checked: z.boolean().default(false),
})

const EdgeCaseSchema = z.object({
  scenario: z.string().min(1),
  expected_behavior: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
})

const ApiDependencySchema = z.object({
  endpoint: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  description: z.string().min(1),
  auth_required: z.boolean().default(true),
})

const AnalyticsEventSchema = z.object({
  event_name: z.string().min(1),
  trigger: z.string().min(1),
  properties: z.string().optional(),
})

const GenerateHandoffSchema = z.object({
  project_id: z.string().uuid(),
  screen_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  version: z.string().default('1.0.0'),
  overview: z.string().min(1),
  business_objective: z.string().min(1),
  user_stories: z.array(UserStorySchema).min(1),
  acceptance_criteria: z.array(AcceptanceCriterionSchema).min(1),
  edge_cases: z.array(EdgeCaseSchema).default([]),
  api_dependencies: z.array(ApiDependencySchema).default([]),
  analytics_events: z.array(AnalyticsEventSchema).default([]),
  technical_notes: z.string().optional(),
  design_decisions: z.string().optional(),
})

type GetHandoffsQuery = z.infer<typeof GetHandoffsQuerySchema>
type GenerateHandoffInput = z.infer<typeof GenerateHandoffSchema>

// ─── Types ────────────────────────────────────────────────────────────────────

interface Handoff {
  id: string
  project_id: string
  screen_id: string | null
  title: string
  version: string
  status: 'draft' | 'published' | 'archived'
  markdown_content: string
  created_by: string
  created_at: string
  updated_at: string
}

interface ProjectMember {
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthToken(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET
  const isSecure =
    req.headers.get('x-forwarded-proto') === 'https' ||
    req.nextUrl.protocol === 'https:'
  return getToken({ req, secret, secureCookie: isSecure })
}

async function getProjectMember(
  projectId: string,
  userId: string,
): Promise<ProjectMember | null> {
  const baseUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL
  if (!baseUrl) return null

  try {
    const res = await fetch(
      `${baseUrl}/projects/${projectId}/members/${userId}`,
      {
        headers: {
          'x-api-key': process.env.INTERNAL_API_KEY ?? '',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    )
    if (!res.ok) return null
    return (await res.json()) as ProjectMember
  } catch {
    return null
  }
}

async function fetchHandoffs(
  query: GetHandoffsQuery,
): Promise<Handoff[]> {
  const baseUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL
  if (!baseUrl) return []

  const params = new URLSearchParams()
  if (query.project_id) params.set('project_id', query.project_id)
  if (query.screen_id) params.set('screen_id', query.screen_id)
  if (query.status) params.set('status', query.status)

  try {
    const res = await fetch(`${baseUrl}/handoffs?${params.toString()}`, {
      headers: {
        'x-api-key': process.env.INTERNAL_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
    if (!res.ok) return []
    return (await res.json()) as Handoff[]
  } catch {
    return []
  }
}

async function insertHandoff(
  payload: Omit<Handoff, 'id' | 'created_at' | 'updated_at'>,
): Promise<Handoff | null> {
  const baseUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL
  if (!baseUrl) return null

  try {
    const res = await fetch(`${baseUrl}/handoffs`, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.INTERNAL_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as Handoff
  } catch {
    return null
  }
}

async function logAudit(event: string, userId: string, meta: Record<string, unknown>) {
  const baseUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL
  if (!baseUrl) return

  try {
    await fetch(`${baseUrl}/audit`, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.INTERNAL_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event, user_id: userId, meta, timestamp: new Date().toISOString() }),
      cache: 'no-store',
    })
  } catch {
    // Audit logging is best-effort; do not throw
  }
}

// ─── Markdown Builder ─────────────────────────────────────────────────────────

function buildMarkdown(input: GenerateHandoffInput, projectName: string): string {
  const timestamp = new Date().toISOString()

  const userStoriesTable =
    '| As a | I want | So that |\n' +
    '|------|--------|----------|\n' +
    input.user_stories
      .map((s) => `| ${s.as_a} | ${s.i_want} | ${s.so_that} |`)
      .join('\n')

  const acceptanceCriteriaChecklist = input.acceptance_criteria
    .map((c) => `- [${c.checked ? 'x' : ' '}] ${c.description}`)
    .join('\n')

  const edgeCasesTable =
    input.edge_cases.length > 0
      ? '| Scenario | Expected Behavior | Severity |\n' +
        '|----------|-------------------|----------|\n' +
        input.edge_cases
          .map((e) => `| ${e.scenario} | ${e.expected_behavior} | ${e.severity} |`)
          .join('\n')
      : '_No edge cases defined._'

  const apiDependenciesTable =
    input.api_dependencies.length > 0
      ? '| Endpoint | Method | Description | Auth Required |\n' +
        '|----------|--------|-------------|---------------|\n' +
        input.api_dependencies
          .map(
            (a) =>
              `| \`${a.endpoint}\` | ${a.method} | ${a.description} | ${a.auth_required ? 'Yes' : 'No'} |`,
          )
          .join('\n')
      : '_No API dependencies defined._'

  const analyticsEventsTable =
    input.analytics_events.length > 0
      ? '| Event Name | Trigger | Properties |\n' +
        '|------------|---------|------------|\n' +
        input.analytics_events
          .map(
            (e) =>
              `| \`${e.event_name}\` | ${e.trigger} | ${e.properties ?? '—'} |`,
          )
          .join('\n')
      : '_No analytics events defined._'

  const technicalNotes = input.technical_notes?.trim()
    ? input.technical_notes.trim()
    : '_No technical notes provided._'

  const designDecisions = input.design_decisions?.trim()
    ? input.design_decisions.trim()
    : '_No design decisions documented._'

  return `# ${input.title}

## Overview

${input.overview}

## Business Objective

${input.business_objective}

## User Stories

${userStoriesTable}

## Acceptance Criteria

${acceptanceCriteriaChecklist}

## Edge Cases

${edgeCasesTable}

## API Dependencies

${apiDependenciesTable}

## Analytics Events

${analyticsEventsTable}

## Technical Notes

${technicalNotes}

## Design Decisions

${designDecisions}

---

Generated: ${timestamp} | Version: ${input.version} | Project: ${projectName}
`
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth check
  const token = await getAuthToken(req)
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Parse and validate query params
  const { searchParams } = req.nextUrl
  const rawQuery = {
    project_id: searchParams.get('project_id') ?? undefined,
    screen_id: searchParams.get('screen_id') ?? undefined,
    status: searchParams.get('status') ?? undefined,
  }

  const parsed = GetHandoffsQuerySchema.safeParse(rawQuery)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid query parameters', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const query = parsed.data

  // Check project membership if project_id provided
  if (query.project_id) {
    const userId = token.sub ?? (token as Record<string, unknown>).userId as string
    const member = await getProjectMember(query.project_id, userId)
    if (!member) {
      return NextResponse.json(
        { message: 'Forbidden: not a member of this project' },
        { status: 403 },
      )
    }
  }

  const handoffs = await fetchHandoffs(query)

  return NextResponse.json({ data: handoffs }, { status: 200 })
}

export async function POST(req: NextRequest) {
  // Auth check
  const token = await getAuthToken(req)
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate body
  const parsed = GenerateHandoffSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation error', errors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const input = parsed.data
  const userId = token.sub ?? (token as Record<string, unknown>).userId as string

  // Check project membership and role (admin/owner only)
  const member = await getProjectMember(input.project_id, userId)
  if (!member) {
    return NextResponse.json(
      { message: 'Forbidden: not a member of this project' },
      { status: 403 },
    )
  }
  if (!['owner', 'admin'].includes(member.role)) {
    return NextResponse.json(
      { message: 'Forbidden: only admins and owners can generate handoffs' },
      { status: 403 },
    )
  }

  // Resolve project name for markdown footer (best-effort)
  let projectName = input.project_id
  try {
    const baseUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL
    if (baseUrl) {
      const projectRes = await fetch(`${baseUrl}/projects/${input.project_id}`, {
        headers: { 'x-api-key': process.env.INTERNAL_API_KEY ?? '' },
        cache: 'no-store',
      })
      if (projectRes.ok) {
        const project = (await projectRes.json()) as { name?: string }
        if (project.name) projectName = project.name
      }
    }
  } catch {
    // Non-fatal: fall back to project_id
  }

  // Build markdown document
  const markdownContent = buildMarkdown(input, projectName)

  // Persist handoff
  const handoff = await insertHandoff({
    project_id: input.project_id,
    screen_id: input.screen_id ?? null,
    title: input.title,
    version: input.version,
    status: 'draft',
    markdown_content: markdownContent,
    created_by: userId,
  })

  if (!handoff) {
    return NextResponse.json(
      { message: 'Failed to store handoff. Please try again.' },
      { status: 500 },
    )
  }

  // Log audit event (best-effort, non-blocking)
  void logAudit('handoff.generated', userId, {
    handoff_id: handoff.id,
    project_id: input.project_id,
    screen_id: input.screen_id,
    title: input.title,
    version: input.version,
  })

  return NextResponse.json({ data: handoff }, { status: 201 })
}
