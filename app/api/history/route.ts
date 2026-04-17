import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readHistory, listHistoryProjects, deleteHistoryEntry, bulkDeleteHistoryEntries } from "@/lib/history-ops";
import { requireAuth } from "@/lib/auth";

const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const searchParams = request.nextUrl.searchParams;

    if (searchParams.get("projects") === "1") {
      const projects = await listHistoryProjects(claudeHome);
      return NextResponse.json({ projects });
    }

    const rawLimit = Number(searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), MAX_LIMIT) : 50;
    const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);
    const project = searchParams.get("project") ?? undefined;
    const sessionId = searchParams.get("session") ?? undefined;

    const page = await readHistory(claudeHome, { limit, offset, project, sessionId });
    return NextResponse.json({ ...page, limit, offset });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const body = await request.json();

    // Bulk delete: body has a `predicates` array.
    if (Array.isArray(body.predicates)) {
      const predicates = body.predicates as Array<unknown>;
      const invalid = predicates.find(
        (p) =>
          typeof (p as Record<string, unknown>).timestamp !== "number" ||
          typeof (p as Record<string, unknown>).sessionId !== "string" ||
          typeof (p as Record<string, unknown>).display !== "string"
      );
      if (invalid) {
        return NextResponse.json(
          { error: "Each predicate requires timestamp (number), sessionId (string), display (string)" },
          { status: 400 }
        );
      }
      const removed = await bulkDeleteHistoryEntries(
        claudeHome,
        predicates as Array<{ timestamp: number; sessionId: string; display: string }>
      );
      return NextResponse.json({ success: true, removed });
    }

    // Single delete (backward compatible).
    const { timestamp, sessionId, display } = body;
    if (
      typeof timestamp !== "number" ||
      typeof sessionId !== "string" ||
      typeof display !== "string"
    ) {
      return NextResponse.json(
        { error: "timestamp (number), sessionId (string), display (string) required" },
        { status: 400 }
      );
    }
    const removed = await deleteHistoryEntry(claudeHome, { timestamp, sessionId, display });
    if (removed === 0) {
      return NextResponse.json({ error: "No matching entry" }, { status: 404 });
    }
    return NextResponse.json({ success: true, removed });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
