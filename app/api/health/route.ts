import { NextRequest, NextResponse } from "next/server";
import { getMode } from "@/lib/mode";
import { getClaudeHome } from "@/lib/claude-home";
import { requireAuth } from "@/lib/auth";
import packageJson from "@/package.json";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  const isAuthenticated = authError === null;

  const response: Record<string, unknown> = {
    status: "ok",
    mode: getMode(),
    version: packageJson.version,
  };

  if (isAuthenticated) {
    try {
      response.claudeHome = getClaudeHome();
    } catch {
      response.claudeHome = null;
    }
  }

  return NextResponse.json(response);
}
