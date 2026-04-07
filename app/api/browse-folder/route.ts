import { NextRequest, NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path, { resolve } from "path";
import os from "os";

export async function GET(request: NextRequest) {
  const homeDir = os.homedir();
  const rawDir = request.nextUrl.searchParams.get("path") || homeDir;
  const dir = resolve(rawDir);

  if (!dir.startsWith(homeDir)) {
    return NextResponse.json(
      { error: "Access denied: can only browse under home directory" },
      { status: 403 }
    );
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
