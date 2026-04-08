import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readSessions, deleteSession, bulkDeleteSessions } from "@/lib/sessions-ops";

export async function GET(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const sessions = await readSessions(claudeHome);
    return NextResponse.json({ sessions, total: sessions.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const fileName = request.nextUrl.searchParams.get("file");
    if (!fileName) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    const ok = await deleteSession(claudeHome, fileName);
    if (!ok) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const body = await request.json() as { olderThanMs?: number | null; dryRun?: boolean };
    const olderThanMs = body.olderThanMs ?? null;
    const dryRun = body.dryRun === true;
    const result = await bulkDeleteSessions(claudeHome, olderThanMs, dryRun);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
