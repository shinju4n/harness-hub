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

function parseProjectRoot(value: string | null): string | undefined {
  if (!value) return undefined;
  // Absolute + no null bytes; full validation lives in claude-md-scopes.
  if (value.includes("\u0000")) return undefined;
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const params = request.nextUrl.searchParams;
    const scope = parseScope(params.get("scope"));
    const projectRoot = parseProjectRoot(params.get("projectRoot"));

    if (scope) {
      const result = await readClaudeMdScope(claudeHome, scope, { projectRoot });
      return NextResponse.json(result);
    }

    const scopes = await listClaudeMdScopes(claudeHome, { projectRoot });
    return NextResponse.json({ scopes });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const { scope, content, projectRoot } = await request.json();
    const parsed = parseScope(scope);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid or missing scope" }, { status: 400 });
    }
    if (typeof content !== "string") {
      return NextResponse.json({ error: "content must be a string" }, { status: 400 });
    }
    const safeProjectRoot =
      typeof projectRoot === "string" ? parseProjectRoot(projectRoot) : undefined;
    await writeClaudeMdScope(claudeHome, parsed, content, { projectRoot: safeProjectRoot });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
