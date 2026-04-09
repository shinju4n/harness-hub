import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import path from "path";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const settingsPath = path.join(claudeHome, "settings.json");
  try {
    const { isHookInstalled } = await import("@/lib/claude-hook-installer");
    return NextResponse.json({ installed: await isHookInstalled(settingsPath) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const settingsPath = path.join(claudeHome, "settings.json");
  try {
    const { installHook } = await import("@/lib/claude-hook-installer");
    await installHook(settingsPath);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const settingsPath = path.join(claudeHome, "settings.json");
  try {
    const { uninstallHook } = await import("@/lib/claude-hook-installer");
    await uninstallHook(settingsPath);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
