import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readHistory, listHistoryProjects } from "@/lib/history-ops";

const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
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

    const page = await readHistory(claudeHome, { limit, offset, project });
    return NextResponse.json({ ...page, limit, offset });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
