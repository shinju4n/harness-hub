import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readJsonFile, writeJsonFile } from "@/lib/file-ops";
import path from "path";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const settings = await readJsonFile<Record<string, unknown>>(
    path.join(claudeHome, "settings.json")
  );
  return NextResponse.json({
    hooks: settings.data?.hooks ?? {},
    mtime: settings.mtime,
  });
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const settingsPath = path.join(claudeHome, "settings.json");
  const { hooks, mtime } = await request.json();

  const settings = await readJsonFile<Record<string, unknown>>(settingsPath);
  if (!settings.data) {
    return NextResponse.json({ error: "Cannot read settings" }, { status: 500 });
  }

  settings.data.hooks = hooks;
  const result = await writeJsonFile(settingsPath, settings.data, mtime);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
