import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import {
  listClaudeMdScopes,
  readClaudeMdScope,
  writeClaudeMdScope,
  type ClaudeMdScopeId,
} from "@/lib/claude-md-scopes";

const VALID_SCOPES: ClaudeMdScopeId[] = ["user", "project", "local", "org"];

function parseScope(value: string | null): ClaudeMdScopeId | null {
  if (!value) return null;
  return VALID_SCOPES.includes(value as ClaudeMdScopeId) ? (value as ClaudeMdScopeId) : null;
}

export async function GET(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const scope = parseScope(request.nextUrl.searchParams.get("scope"));

    if (scope) {
      const result = await readClaudeMdScope(claudeHome, scope);
      return NextResponse.json(result);
    }

    const scopes = await listClaudeMdScopes(claudeHome);
    return NextResponse.json({ scopes });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const { scope, content } = await request.json();
    const parsed = parseScope(scope);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid or missing scope" }, { status: 400 });
    }
    if (typeof content !== "string") {
      return NextResponse.json({ error: "content must be a string" }, { status: 400 });
    }
    await writeClaudeMdScope(claudeHome, parsed, content);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
