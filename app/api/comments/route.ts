import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const GetThreadsQuerySchema = z.object({
  screen_id: z.string().uuid({ message: "screen_id must be a valid UUID" }),
  status: z
    .enum(["open", "resolved", "all"])
    .optional()
    .default("all"),
  deployment_id: z
    .string()
    .uuid({ message: "deployment_id must be a valid UUID" })
    .optional(),
});

const CreateThreadSchema = z.object({
  screen_id: z.string().uuid({ message: "screen_id must be a valid UUID" }),
  deployment_id: z
    .string()
    .uuid({ message: "deployment_id must be a valid UUID" })
    .optional(),
  position_x: z.number().optional(),
  position_y: z.number().optional(),
  body: z.string().min(1, "Comment body is required").max(10000),
  mentions: z.array(z.string().uuid()).optional().default([]),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProjectRole = "owner" | "admin" | "reviewer" | "viewer";

const REVIEWER_ROLES: ProjectRole[] = ["owner", "admin", "reviewer"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// ---------------------------------------------------------------------------
// GET /api/comments
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse("Unauthorized", 401);
  }

  // Parse and validate query params
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parseResult = GetThreadsQuerySchema.safeParse(searchParams);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { screen_id, status, deployment_id } = parseResult.data;

  // Fetch screen to get project_id
  const { data: screen, error: screenError } = await supabase
    .from("screens")
    .select("id, project_id")
    .eq("id", screen_id)
    .single();

  if (screenError || !screen) {
    return errorResponse("Screen not found", 404);
  }

  // Check user is a project member
  const { data: membership, error: membershipError } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", screen.project_id)
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    return errorResponse("Forbidden: you are not a member of this project", 403);
  }

  // Build threads query
  let threadsQuery = supabase
    .from("comment_threads")
    .select(
      `
      id,
      screen_id,
      deployment_id,
      position_x,
      position_y,
      status,
      created_at,
      updated_at,
      root_comment:comments!comment_threads_root_comment_id_fkey (
        id,
        body,
        created_at,
        updated_at,
        author_id
      ),
      reply_count:comments(count)
      `
    )
    .eq("screen_id", screen_id);

  if (status !== "all") {
    threadsQuery = threadsQuery.eq("status", status);
  }

  if (deployment_id) {
    threadsQuery = threadsQuery.eq("deployment_id", deployment_id);
  }

  const { data: threads, error: threadsError } = await threadsQuery.order(
    "created_at",
    { ascending: false }
  );

  if (threadsError) {
    console.error("[GET /api/comments] threads query error:", threadsError);
    return errorResponse("Failed to fetch threads", 500);
  }

  if (!threads || threads.length === 0) {
    return NextResponse.json({ threads: [] }, { status: 200 });
  }

  // Collect unique author IDs from root comments
  const authorIds = Array.from(
    new Set(
      threads
        .map((t: any) => t.root_comment?.author_id)
        .filter(Boolean) as string[]
    )
  );

  // Fetch author profiles from auth.users metadata via RPC or profiles table
  let profilesMap: Record<string, { id: string; full_name: string | null; avatar_url: string | null; email: string | null }> = {};

  if (authorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .in("id", authorIds);

    if (!profilesError && profiles) {
      profilesMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
    }
  }

  // Enrich threads with author profiles
  const enrichedThreads = threads.map((thread: any) => {
    const rootComment = thread.root_comment;
    const authorId = rootComment?.author_id;
    return {
      ...thread,
      reply_count:
        typeof thread.reply_count === "number"
          ? thread.reply_count
          : Array.isArray(thread.reply_count)
          ? (thread.reply_count[0] as any)?.count ?? 0
          : 0,
      root_comment: rootComment
        ? {
            ...rootComment,
            author: authorId ? profilesMap[authorId] ?? null : null,
          }
        : null,
    };
  });

  return NextResponse.json({ threads: enrichedThreads }, { status: 200 });
}

// ---------------------------------------------------------------------------
// POST /api/comments
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse("Unauthorized", 401);
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parseResult = CreateThreadSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const {
    screen_id,
    deployment_id,
    position_x,
    position_y,
    body: commentBody,
    mentions,
  } = parseResult.data;

  // Fetch screen to get project_id
  const { data: screen, error: screenError } = await supabase
    .from("screens")
    .select("id, project_id")
    .eq("id", screen_id)
    .single();

  if (screenError || !screen) {
    return errorResponse("Screen not found", 404);
  }

  // Check user role — must be reviewer, admin, or owner
  const { data: membership, error: membershipError } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", screen.project_id)
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    return errorResponse("Forbidden: you are not a member of this project", 403);
  }

  if (!REVIEWER_ROLES.includes(membership.role as ProjectRole)) {
    return errorResponse(
      "Forbidden: insufficient role to create comments",
      403
    );
  }

  // Transactional insert via RPC (Supabase does not support multi-statement
  // transactions directly from the client, so we use a database function).
  // Fallback: sequential inserts with manual rollback on failure.
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "create_comment_thread",
    {
      p_screen_id: screen_id,
      p_project_id: screen.project_id,
      p_deployment_id: deployment_id ?? null,
      p_position_x: position_x ?? null,
      p_position_y: position_y ?? null,
      p_body: commentBody,
      p_author_id: user.id,
      p_mentions: mentions,
    }
  );

  if (rpcError) {
    // Fallback: manual sequential insert if RPC is not yet deployed
    console.warn(
      "[POST /api/comments] RPC not available, falling back to sequential inserts:",
      rpcError.message
    );

    // 1. Create the thread (without root_comment_id first)
    const { data: thread, error: threadError } = await supabase
      .from("comment_threads")
      .insert({
        screen_id,
        project_id: screen.project_id,
        deployment_id: deployment_id ?? null,
        position_x: position_x ?? null,
        position_y: position_y ?? null,
        status: "open",
        created_by: user.id,
      })
      .select("*")
      .single();

    if (threadError || !thread) {
      console.error("[POST /api/comments] thread insert error:", threadError);
      return errorResponse("Failed to create thread", 500);
    }

    // 2. Create the root comment
    const { data: comment, error: commentError } = await supabase
      .from("comments")
      .insert({
        thread_id: thread.id,
        author_id: user.id,
        body: commentBody,
        mentions,
        is_root: true,
      })
      .select("*")
      .single();

    if (commentError || !comment) {
      console.error("[POST /api/comments] comment insert error:", commentError);
      // Best-effort cleanup
      await supabase.from("comment_threads").delete().eq("id", thread.id);
      return errorResponse("Failed to create comment", 500);
    }

    // 3. Update thread with root_comment_id
    const { error: updateError } = await supabase
      .from("comment_threads")
      .update({ root_comment_id: comment.id })
      .eq("id", thread.id);

    if (updateError) {
      console.error(
        "[POST /api/comments] thread root_comment_id update error:",
        updateError
      );
      // Non-fatal — thread and comment exist; log but continue
    }

    // 4. Log audit entry
    await supabase.from("audit_logs").insert({
      action: "comment_thread.created",
      actor_id: user.id,
      project_id: screen.project_id,
      resource_type: "comment_thread",
      resource_id: thread.id,
      metadata: {
        screen_id,
        deployment_id: deployment_id ?? null,
        comment_id: comment.id,
      },
    });

    // 5. Fetch author profile
    const { data: authorProfile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .eq("id", user.id)
      .single();

    return NextResponse.json(
      {
        thread: {
          ...thread,
          root_comment_id: comment.id,
          root_comment: {
            ...comment,
            author: authorProfile ?? null,
          },
          reply_count: 0,
        },
      },
      { status: 201 }
    );
  }

  // RPC success path
  return NextResponse.json({ thread: rpcResult }, { status: 201 });
}
