import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readJsonFile, writeJsonFile } from "@/lib/file-ops";
import path from "path";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const result = await readJsonFile<Record<string, unknown>>(
    path.join(claudeHome, "keybindings.json")
  );
  return NextResponse.json({
    keybindings: result.data ?? {},
    mtime: result.mtime,
    exists: result.data !== null,
  });
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const filePath = path.join(claudeHome, "keybindings.json");
  const { keybindings } = await request.json();

  const current = await readJsonFile(filePath);
  if (current.mtime) {
    const result = await writeJsonFile(filePath, keybindings, current.mtime);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
  } else {
    // File doesn't exist yet, create it
    const { writeFile } = await import("fs/promises");
    await writeFile(filePath, JSON.stringify(keybindings, null, 2) + "\n", "utf-8");
  }

  return NextResponse.json({ success: true });
}
