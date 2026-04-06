import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readMarkdownFile } from "@/lib/file-ops";
import { readdir, writeFile, mkdir, rm } from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const skillName = request.nextUrl.searchParams.get("name");
  const source = request.nextUrl.searchParams.get("source");
  const pluginName = request.nextUrl.searchParams.get("plugin");

  if (skillName) {
    if (skillName.includes("..") || skillName.includes("/") || skillName.includes("\\")) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    let skillPath: string;
    if (source === "custom") {
      const dirPath = path.join(claudeHome, "skills", skillName);
      const files = await readdir(dirPath).catch(() => []);
      const mdFile = files.find((f: string) => f.endsWith(".md"));
      skillPath = mdFile ? path.join(dirPath, mdFile) : path.join(dirPath, "index.md");
    } else {
      skillPath = await findPluginSkillPath(claudeHome, pluginName ?? "", skillName);
    }

    const result = await readMarkdownFile(skillPath);
    if (result.data) {
      return NextResponse.json({ content: result.data.content, frontmatter: result.data.frontmatter });
    }
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const { readFullConfig } = await import("@/lib/config-reader");
  const config = await readFullConfig(claudeHome);
  return NextResponse.json(config.skills);
}

export async function POST(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const { name, content } = await request.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }
  const dirPath = path.join(claudeHome, "skills", name);
  await mkdir(dirPath, { recursive: true });
  const filePath = path.join(dirPath, "SKILL.md");
  try {
    await writeFile(filePath, content ?? "", "utf-8");
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const name = request.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }
  const dirPath = path.join(claudeHome, "skills", name);
  try {
    await rm(dirPath, { recursive: true, force: true });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const { name, content } = await request.json();

  if (!name || typeof content !== "string") {
    return NextResponse.json({ error: "name and content required" }, { status: 400 });
  }
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const dirPath = path.join(claudeHome, "skills", name);
  try {
    const files = await readdir(dirPath);
    const mdFile = files.find((f: string) => f.endsWith(".md"));
    if (!mdFile) {
      return NextResponse.json({ error: "Skill file not found" }, { status: 404 });
    }
    await writeFile(path.join(dirPath, mdFile), content, "utf-8");
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function findPluginSkillPath(claudeHome: string, pluginName: string, skillName: string): Promise<string> {
  const cacheDir = path.join(claudeHome, "plugins", "cache");
  const marketplaces = await readdir(cacheDir, { withFileTypes: true });
  for (const mp of marketplaces) {
    if (!mp.isDirectory() || mp.name.startsWith(".")) continue;
    const pluginDir = path.join(cacheDir, mp.name, pluginName);
    try {
      const versions = await readdir(pluginDir, { withFileTypes: true });
      const latest = versions.filter((v) => v.isDirectory()).pop();
      if (!latest) continue;
      const skillDir = path.join(pluginDir, latest.name, "skills", skillName);
      const files = await readdir(skillDir);
      const mdFile = files.find((f: string) => f.endsWith(".md") && !f.startsWith("."));
      if (mdFile) return path.join(skillDir, mdFile);
    } catch {}
  }
  return "";
}
