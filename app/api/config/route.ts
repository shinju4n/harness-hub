import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest, detectClaudeInstallation } from "@/lib/claude-home";
import { readFullConfig } from "@/lib/config-reader";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const installation = await detectClaudeInstallation(claudeHome);

    if (!installation.exists) {
      return NextResponse.json(
        { error: "Claude Code not detected", path: claudeHome },
        { status: 404 }
      );
    }

    const config = await readFullConfig(claudeHome);
    return NextResponse.json({ installation, ...config });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
