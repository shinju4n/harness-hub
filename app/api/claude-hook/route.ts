import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import path from "path";

export async function GET(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const settingsPath = path.join(claudeHome, "settings.json");
  const { isHookInstalled } = await import("@/lib/claude-hook-installer");
  return NextResponse.json({ installed: await isHookInstalled(settingsPath) });
}

export async function POST(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const settingsPath = path.join(claudeHome, "settings.json");
  const { installHook } = await import("@/lib/claude-hook-installer");
  await installHook(settingsPath);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const settingsPath = path.join(claudeHome, "settings.json");
  const { uninstallHook } = await import("@/lib/claude-hook-installer");
  await uninstallHook(settingsPath);
  return NextResponse.json({ success: true });
}
