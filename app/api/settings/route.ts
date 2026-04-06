import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readJsonFile, writeJsonFile, readMarkdownFile } from "@/lib/file-ops";
import { writeFile } from "fs/promises";
import path from "path";

async function findClaudeMdPath(claudeHome: string): Promise<{ filePath: string; content: string }> {
  // Try inside claudeHome first
  const inside = await readMarkdownFile(path.join(claudeHome, "CLAUDE.md"));
  if (inside.data) return { filePath: path.join(claudeHome, "CLAUDE.md"), content: inside.data.content };

  // Try parent dir (project-level: .claude/ → project root CLAUDE.md)
  const parent = await readMarkdownFile(path.join(path.dirname(claudeHome), "CLAUDE.md"));
  if (parent.data) return { filePath: path.join(path.dirname(claudeHome), "CLAUDE.md"), content: parent.data.content };

  return { filePath: path.join(claudeHome, "CLAUDE.md"), content: "" };
}

export async function GET(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const [settings, claudeMd] = await Promise.all([
    readJsonFile(path.join(claudeHome, "settings.json")),
    findClaudeMdPath(claudeHome),
  ]);

  return NextResponse.json({
    settings: settings.data,
    settingsMtime: settings.mtime,
    claudeMd: claudeMd.content,
  });
}

export async function PUT(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const { type, content } = await request.json();

  if (type === "claude-md") {
    const { filePath } = await findClaudeMdPath(claudeHome);
    await writeFile(filePath, content, "utf-8");
    return NextResponse.json({ success: true });
  }

  if (type === "settings") {
    const settingsPath = path.join(claudeHome, "settings.json");
    const current = await readJsonFile(settingsPath);
    if (!current.mtime) {
      return NextResponse.json({ error: "Cannot read settings.json" }, { status: 500 });
    }
    const result = await writeJsonFile(settingsPath, content, current.mtime);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
