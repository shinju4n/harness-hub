import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readSessions } from "@/lib/sessions-ops";

export async function GET(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const sessions = await readSessions(claudeHome);
    return NextResponse.json({ sessions, total: sessions.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
