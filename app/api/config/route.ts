import { NextResponse } from "next/server";
import { getClaudeHome, detectClaudeInstallation } from "@/lib/claude-home";
import { readFullConfig } from "@/lib/config-reader";

export async function GET() {
  try {
    const claudeHome = getClaudeHome();
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
