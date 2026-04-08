import { NextRequest, NextResponse } from "next/server";
import { detectClaudeInstallation, getClaudeHomeFromRequest } from "@/lib/claude-home";
import { runHarnessScore } from "@/lib/harness-score/runner";

// Score depends on live filesystem state — never cache.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const installation = await detectClaudeInstallation(claudeHome);

    if (!installation.exists) {
      return NextResponse.json(
        { error: "Claude Code not detected", path: claudeHome },
        { status: 404 },
      );
    }

    const report = await runHarnessScore(claudeHome);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
