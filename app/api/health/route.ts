import { NextResponse } from "next/server";
import { getMode } from "@/lib/mode";
import { getClaudeHome } from "@/lib/claude-home";
import packageJson from "@/package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  let claudeHome: string | null = null;
  try {
    claudeHome = getClaudeHome();
  } catch {
    // CLAUDE_HOME not configured — leave null
  }

  return NextResponse.json({
    status: "ok",
    mode: getMode(),
    version: packageJson.version,
    claudeHome,
  });
}
