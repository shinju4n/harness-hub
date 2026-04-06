import { NextRequest, NextResponse } from "next/server";
import { getClaudeHome } from "@/lib/claude-home";
import { readJsonFile, readMarkdownFile } from "@/lib/file-ops";
import { writeFile } from "fs/promises";
import path from "path";

export async function GET() {
  const claudeHome = getClaudeHome();
  const [settings, claudeMd] = await Promise.all([
    readJsonFile(path.join(claudeHome, "settings.json")),
    readMarkdownFile(path.join(claudeHome, "CLAUDE.md")),
  ]);

  return NextResponse.json({
    settings: settings.data,
    settingsMtime: settings.mtime,
    claudeMd: claudeMd.data?.content ?? "",
  });
}

export async function PUT(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const { type, content } = await request.json();

  if (type === "claude-md") {
    const filePath = path.join(claudeHome, "CLAUDE.md");
    await writeFile(filePath, content, "utf-8");
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
