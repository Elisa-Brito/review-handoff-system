import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ReviewPin {
  id: string
  thread_id: string
  screen_id: string
  x: number
  y: number
  label: string | null
  status: 'open' | 'resolved'
  comment_count: number
  created_at: string
  updated_at: string
  author: {
    id: string
    name: string | null
    email: string
  }
  comments: Array<{
    id: string
    body: string
    created_at: string
    author: {
      id: string
      name: string | null
      email: string
    }
  }>
}

export interface ReviewScreen {
  id: string
  project_id: string
  name: string
  route: string
  description: string | null
  deployment_id: string | null
  created_at: string
  updated_at: string
}

export interface ReviewDeployment {
  id: string
  project_id: string
  url: string
  environment: string
  status: 'pending' | 'active' | 'archived'
  created_at: string
}

export interface ReviewProject {
  id: string
  name: string
  description: string | null
  organization_id: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// In-memory store (replace with your DB client — e.g. Supabase, Prisma, etc.)
// ---------------------------------------------------------------------------

const _projects: ReviewProject[] = []
const _screens: ReviewScreen[] = []
const _deployments: ReviewDeployment[] = []
const _pins: ReviewPin[] = []

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ---------------------------------------------------------------------------
// GET /api/review?screen_id=
// ---------------------------------------------------------------------------

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const screenId = searchParams.get('screen_id')

  if (!screenId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: screen_id' },
      { status: 400 }
    )
  }

  const screen = _screens.find((s) => s.id === screenId)
  if (!screen) {
    return NextResponse.json(
      { error: 'Screen not found' },
      { status: 404 }
    )
  }

  const pins = _pins.filter((p) => p.screen_id === screenId)
  const openThreadCount = pins.filter((p) => p.status === 'open').length

  const deployment = screen.deployment_id
    ? (_deployments.find((d) => d.id === screen.deployment_id) ?? null)
    : null

  return NextResponse.json({
    screen,
    pins,
    open_thread_count: openThreadCount,
    deployment,
  })
}

// ---------------------------------------------------------------------------
// POST /api/review/projects
// ---------------------------------------------------------------------------

async function handlePostProject(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string; description?: string; organization_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, description, organization_id } = body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json(
      { error: 'Missing required field: name' },
      { status: 422 }
    )
  }

  const now = new Date().toISOString()
  const project: ReviewProject = {
    id: generateId(),
    name: name.trim(),
    description: description?.trim() ?? null,
    organization_id: organization_id ?? null,
    created_at: now,
    updated_at: now,
  }

  _projects.push(project)

  // The trigger that auto-inserts the creator as owner would fire here in a
  // real DB (e.g. Supabase DB trigger). Represented as a comment placeholder:
  // await db.projectMembers.insert({ project_id: project.id, user_id: session.user.id, role: 'owner' })

  return NextResponse.json(project, { status: 201 })
}

// ---------------------------------------------------------------------------
// POST /api/review/screens
// ---------------------------------------------------------------------------

async function handlePostScreen(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    project_id?: string
    name?: string
    route?: string
    description?: string
    deployment_id?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { project_id, name, route, description, deployment_id } = body

  if (!project_id || !name || !route) {
    return NextResponse.json(
      { error: 'Missing required fields: project_id, name, route' },
      { status: 422 }
    )
  }

  const project = _projects.find((p) => p.id === project_id)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Admin/owner guard: in production verify membership role from DB
  // const member = await db.projectMembers.find({ project_id, user_id: session.user.id })
  // if (!member || !['admin', 'owner'].includes(member.role)) {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // }

  const now = new Date().toISOString()
  const screen: ReviewScreen = {
    id: generateId(),
    project_id,
    name: name.trim(),
    route: route.trim(),
    description: description?.trim() ?? null,
    deployment_id: deployment_id ?? null,
    created_at: now,
    updated_at: now,
  }

  _screens.push(screen)

  return NextResponse.json(screen, { status: 201 })
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleGet(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { pathname } = new URL(request.url)

  if (pathname.endsWith('/projects')) {
    return handlePostProject(request)
  }

  if (pathname.endsWith('/screens')) {
    return handlePostScreen(request)
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
