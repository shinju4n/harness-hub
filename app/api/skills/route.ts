import { NextRequest, NextResponse } from "next/server";
import { getClaudeHome } from "@/lib/claude-home";
import { readMarkdownFile } from "@/lib/file-ops";
import { readdir } from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const skillName = request.nextUrl.searchParams.get("name");
  const source = request.nextUrl.searchParams.get("source");
  const pluginName = request.nextUrl.searchParams.get("plugin");

  if (skillName) {
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
