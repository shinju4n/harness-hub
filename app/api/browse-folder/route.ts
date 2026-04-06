import { NextRequest, NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import path from "path";
import os from "os";

export async function GET(request: NextRequest) {
  const dir = request.nextUrl.searchParams.get("path") || os.homedir();

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
