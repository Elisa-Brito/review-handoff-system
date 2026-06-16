I have enough context now to generate the route file.

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import {
  UpdateCommentSchema,
  UpdateThreadStatusSchema,
  AddReplySchema,
} from 'app/lib/validations/comments'

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

type Role = 'viewer' | 'reviewer' | 'admin' | 'owner'

const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  reviewer: 1,
  admin: 2,
  owner: 3,
}

function hasRole(userRole: Role, required: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[required]
}

// ---------------------------------------------------------------------------
// Auth helper — resolves session + project membership from access token
// ---------------------------------------------------------------------------

interface SessionUser {
  sub: string
  role: Role
  projectIds: string[]
}

async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const isSecure =
    req.headers.get('x-forwarded-proto') === 'https' ||
    req.nextUrl.protocol === 'https:'

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isSecure,
    cookieName: isSecure
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token',
  })

  if (!token?.sub) return null

  // These claims are expected to have been embedded into the JWT during the
  // NextAuth jwt callback from the Keycloak access token.
  return {
    sub: token.sub as string,
    role: (token.role as Role) ?? 'viewer',
    projectIds: (token.projectIds as string[]) ?? [],
  }
}

// ---------------------------------------------------------------------------
// DB helpers — replace with your actual DB client / ORM calls
// ---------------------------------------------------------------------------

interface Comment {
  id: string
  thread_id: string
  project_id: string
  author_id: string
  content: string
  status: string | null   // only set on root/thread comment
  priority: string | null
  deleted_at: string | null
  deleted_by: string | null
  parent_id: string | null
}

async function fetchComment(id: string): Promise<Comment | null> {
  // TODO: replace with real DB query
  void id
  return null
}

async function patchCommentContent(
  id: string,
  content: string,
): Promise<Comment> {
  // TODO: replace with real DB query
  void id
  void content
  throw new Error('not implemented')
}

async function patchThreadStatus(
  threadId: string,
  status: string,
  actorId: string,
): Promise<Comment> {
  // TODO: replace with real DB query — also push to comment_history
  void threadId
  void status
  void actorId
  throw new Error('not implemented')
}

async function patchCommentPriority(
  id: string,
  priority: string,
): Promise<Comment> {
  // TODO: replace with real DB query
  void id
  void priority
  throw new Error('not implemented')
}

async function insertReply(
  threadId: string,
  authorId: string,
  content: string,
): Promise<Comment> {
  // TODO: replace with real DB query
  void threadId
  void authorId
  void content
  throw new Error('not implemented')
}

async function softDeleteComment(
  id: string,
  deletedBy: string,
): Promise<Comment> {
  // TODO: replace with real DB query
  void id
  void deletedBy
  throw new Error('not implemented')
}

async function logAudit(entry: {
  entity: string
  entity_id: string
  action: string
  actor_id: string
  payload: unknown
}): Promise<void> {
  // TODO: replace with real audit-log write
  console.log('[audit]', entry) // eslint-disable-line no-console
}

// ---------------------------------------------------------------------------
// PATCH /api/comments/[id]
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const comment = await fetchComment(params.id)
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  if (comment.deleted_at) {
    return NextResponse.json({ error: 'Comment has been deleted' }, { status: 410 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Attempt: update thread status ──────────────────────────────────────

  const statusParse = UpdateThreadStatusSchema.safeParse(body)
  if (statusParse.success) {
    // Only reviewer+ can change thread status; admin/owner may touch any thread.
    if (!hasRole(user.role, 'reviewer')) {
      return NextResponse.json(
        { error: 'Forbidden: reviewer role required to change thread status' },
        { status: 403 },
      )
    }

    const isOwnerOfComment = comment.author_id === user.sub
    const isAdminOrOwner = hasRole(user.role, 'admin')

    if (!isOwnerOfComment && !isAdminOrOwner) {
      return NextResponse.json(
        { error: 'Forbidden: you may only resolve/reopen threads you own unless you are an admin or owner' },
        { status: 403 },
      )
    }

    try {
      const updated = await patchThreadStatus(
        comment.thread_id,
        statusParse.data.status,
        user.sub,
      )

      await logAudit({
        entity: 'comment',
        entity_id: params.id,
        action: `status_changed_to_${statusParse.data.status}`,
        actor_id: user.sub,
        payload: { previous_status: comment.status, new_status: statusParse.data.status },
      })

      return NextResponse.json(updated)
    } catch (err) {
      console.error('[PATCH /api/comments/[id]] patchThreadStatus failed', err) // eslint-disable-line no-console
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  // ── Attempt: update priority ───────────────────────────────────────────

  const priorityBody = body as Record<string, unknown>
  if (priorityBody && 'priority' in priorityBody) {
    if (!hasRole(user.role, 'admin')) {
      return NextResponse.json(
        { error: 'Forbidden: admin role required to change priority' },
        { status: 403 },
      )
    }

    const priorityValues = ['low', 'normal', 'high', 'critical'] as const
    const priority = priorityBody.priority as string
    if (!priorityValues.includes(priority as (typeof priorityValues)[number])) {
      return NextResponse.json(
        { error: 'Invalid priority value. Must be one of: low, normal, high, critical' },
        { status: 422 },
      )
    }

    try {
      const updated = await patchCommentPriority(params.id, priority)
      return NextResponse.json(updated)
    } catch (err) {
      console.error('[PATCH /api/comments/[id]] patchCommentPriority failed', err) // eslint-disable-line no-console
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  // ── Attempt: update content ────────────────────────────────────────────

  const contentParse = UpdateCommentSchema.safeParse(body)
  if (!contentParse.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: contentParse.error.flatten() },
      { status: 422 },
    )
  }

  if (comment.author_id !== user.sub) {
    return NextResponse.json(
      { error: 'Forbidden: you may only edit your own comments' },
      { status: 403 },
    )
  }

  try {
    const updated = await patchCommentContent(params.id, contentParse.data.content)
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/comments/[id]] patchCommentContent failed', err) // eslint-disable-line no-console
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/comments/[id]/replies  — handled in [id]/replies/route.ts
// This file only exports the sub-route handler so it can be co-located.
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // The [id] here is the parent comment / thread root id.
  const user = await getSessionUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parent = await fetchComment(params.id)
  if (!parent) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  if (parent.deleted_at) {
    return NextResponse.json({ error: 'Cannot reply to a deleted comment' }, { status: 410 })
  }

  if (!user.projectIds.includes(parent.project_id)) {
    return NextResponse.json(
      { error: 'Forbidden: you are not a member of this project' },
      { status: 403 },
    )
  }

  if (!hasRole(user.role, 'reviewer')) {
    return NextResponse.json(
      { error: 'Forbidden: reviewer role or higher required to reply' },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parse = AddReplySchema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parse.error.flatten() },
      { status: 422 },
    )
  }

  if (parse.data.thread_id !== parent.thread_id && parse.data.thread_id !== params.id) {
    return NextResponse.json(
      { error: 'thread_id in body does not match the addressed thread' },
      { status: 422 },
    )
  }

  try {
    const reply = await insertReply(parent.thread_id, user.sub, parse.data.content)

    await logAudit({
      entity: 'comment',
      entity_id: reply.id,
      action: 'reply_added',
      actor_id: user.sub,
      payload: { thread_id: parent.thread_id, parent_comment_id: params.id },
    })

    return NextResponse.json(reply, { status: 201 })
  } catch (err) {
    console.error('[POST /api/comments/[id]] insertReply failed', err) // eslint-disable-line no-console
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/comments/[id]
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const comment = await fetchComment(params.id)
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  if (comment.deleted_at) {
    return NextResponse.json({ error: 'Comment is already deleted' }, { status: 410 })
  }

  const isOwnComment = comment.author_id === user.sub
  const isAdminOrOwner = hasRole(user.role, 'admin')

  if (!isOwnComment && !isAdminOrOwner) {
    return NextResponse.json(
      { error: 'Forbidden: you may only delete your own comments unless you are an admin or owner' },
      { status: 403 },
    )
  }

  try {
    const deleted = await softDeleteComment(params.id, user.sub)
    return NextResponse.json(deleted)
  } catch (err) {
    console.error('[DELETE /api/comments/[id]] softDeleteComment failed', err) // eslint-disable-line no-console
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
