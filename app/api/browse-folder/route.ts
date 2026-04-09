import { NextRequest, NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path, { resolve } from "path";
import os from "os";
import { isWebMode } from "@/lib/mode";
import { getClaudeHome } from "@/lib/claude-home";
import {
  assertWithinClaudeHome,
  PathConfinementError,
} from "@/lib/safe-path";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const baseDir = isWebMode() ? getClaudeHome() : os.homedir();
  const rawDir = request.nextUrl.searchParams.get("path") || baseDir;
  const dir = resolve(rawDir);

  // In web mode, enforce CLAUDE_HOME confinement
  if (isWebMode()) {
    try {
      assertWithinClaudeHome(dir);
    } catch (err) {
      if (err instanceof PathConfinementError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      throw err;
    }
  } else {
    // Desktop mode: existing behavior — only allow under home directory
    if (!dir.startsWith(baseDir)) {
      return NextResponse.json(
        { error: "Access denied: can only browse under home directory" },
        { status: 403 }
      );
    }
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const folders = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({
        name: e.name,
        path: path.join(dir, e.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Also check if .claude exists in hidden dirs
    const hasClaude = entries.some((e) => e.name === ".claude" && e.isDirectory());

    return NextResponse.json({
      current: dir,
      parent: path.dirname(dir),
      folders,
      hasClaude,
    });
  } catch {
    return NextResponse.json({ current: dir, parent: path.dirname(dir), folders: [], hasClaude: false });
  }
}
