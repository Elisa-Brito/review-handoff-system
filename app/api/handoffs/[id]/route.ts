import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ─── Schemas ────────────────────────────────────────────────────────────────

const UpdateHandoffSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "in_review", "approved"]).optional(),
  sections: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().min(1),
        content: z.string(),
        order: z.number().int().min(0),
      })
    )
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

const PublishHandoffSchema = z.object({
  status: z.literal("published"),
  publishedAt: z.string().datetime().optional(),
});

type UpdateHandoffInput = z.infer<typeof UpdateHandoffSchema>;
type PublishHandoffInput = z.infer<typeof PublishHandoffSchema>;

// ─── Mock DB helpers (replace with your ORM/DB client) ──────────────────────

interface HandoffSection {
  id: string;
  title: string;
  content: string;
  order: number;
}

interface Handoff {
  id: string;
  title: string;
  description: string;
  status: string;
  projectId: string;
  ownerId: string;
  sections: HandoffSection[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

async function getHandoffById(id: string): Promise<Handoff | null> {
  // Replace with actual DB query
  // e.g. return prisma.handoff.findUnique({ where: { id }, include: { sections: { orderBy: { order: 'asc' } } } })
  void id;
  return null;
}

async function updateHandoffById(
  id: string,
  data: UpdateHandoffInput | PublishHandoffInput
): Promise<Handoff> {
  // Replace with actual DB update
  // e.g. return prisma.handoff.update({ where: { id }, data: { ...data, updatedAt: new Date() } })
  void id;
  void data;
  throw new Error("Not implemented");
}

async function logAudit(params: {
  action: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  payload: unknown;
}) {
  // Replace with your audit log implementation
  // e.g. await prisma.auditLog.create({ data: { ...params, createdAt: new Date() } })
  void params;
}

// ─── Auth helpers (replace with your auth solution) ─────────────────────────

interface AuthUser {
  id: string;
  role: "admin" | "owner" | "member";
}

async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  // Replace with your session/JWT check
  // e.g. const session = await getServerSession(authOptions)
  // return session?.user ?? null
  void request;
  return null;
}

async function isProjectMember(
  userId: string,
  projectId: string
): Promise<boolean> {
  // Replace with actual membership check
  void userId;
  void projectId;
  return false;
}

function isAdminOrOwner(user: AuthUser, handoff: Handoff): boolean {
  return user.role === "admin" || handoff.ownerId === user.id;
}

// ─── Markdown serializer ─────────────────────────────────────────────────────

function handoffToMarkdown(handoff: Handoff): string {
  const lines: string[] = [];

  lines.push(`# ${handoff.title}`);
  lines.push("");

  if (handoff.description) {
    lines.push(handoff.description);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`**Status:** ${handoff.status}`);
  lines.push(`**Created:** ${handoff.createdAt}`);
  lines.push(`**Last Updated:** ${handoff.updatedAt}`);

  if (handoff.publishedAt) {
    lines.push(`**Published:** ${handoff.publishedAt}`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");

  const sorted = [...handoff.sections].sort((a, b) => a.order - b.order);

  for (const section of sorted) {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(section.content);
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Route params type ───────────────────────────────────────────────────────

interface RouteContext {
  params: { id: string };
}

// ─── GET /api/handoffs/[id] ──────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { id } = params;

  // Handle export sub-route via search param convention or by checking URL
  const { pathname } = new URL(request.url);
  if (pathname.endsWith("/export")) {
    return handleExport(request, id);
  }

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const handoff = await getHandoffById(id);
  if (!handoff) {
    return NextResponse.json({ error: "Handoff not found" }, { status: 404 });
  }

  const member = await isProjectMember(user.id, handoff.projectId);
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: handoff });
}

// ─── PATCH /api/handoffs/[id] ────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { id } = params;

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const handoff = await getHandoffById(id);
  if (!handoff) {
    return NextResponse.json({ error: "Handoff not found" }, { status: 404 });
  }

  if (!isAdminOrOwner(user, handoff)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Try PublishHandoffSchema first (more specific), then UpdateHandoffSchema
  let validatedData: UpdateHandoffInput | PublishHandoffInput;

  const publishResult = PublishHandoffSchema.safeParse(body);
  if (publishResult.success) {
    validatedData = publishResult.data;
  } else {
    const updateResult = UpdateHandoffSchema.safeParse(body);
    if (!updateResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: updateResult.error.flatten(),
        },
        { status: 422 }
      );
    }
    validatedData = updateResult.data;
  }

  let updated: Handoff;
  try {
    updated = await updateHandoffById(id, validatedData);
  } catch (err) {
    console.error("[PATCH /api/handoffs/[id]] update failed", err);
    return NextResponse.json(
      { error: "Failed to update handoff" },
      { status: 500 }
    );
  }

  await logAudit({
    action: "handoff.update",
    resourceType: "Handoff",
    resourceId: id,
    userId: user.id,
    payload: validatedData,
  });

  return NextResponse.json({ data: updated });
}

// ─── Export handler (called from GET when path ends with /export) ────────────

async function handleExport(
  request: NextRequest,
  id: string
): Promise<NextResponse> {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const handoff = await getHandoffById(id);
  if (!handoff) {
    return NextResponse.json({ error: "Handoff not found" }, { status: 404 });
  }

  const member = await isProjectMember(user.id, handoff.projectId);
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const markdown = handoffToMarkdown(handoff);

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="handoff-${id}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
