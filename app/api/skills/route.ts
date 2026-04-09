import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readMarkdownFile } from "@/lib/file-ops";
import { readdir, readFile, writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/auth";

interface FileTreeNode {
  name: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

async function buildFileTree(dirPath: string): Promise<FileTreeNode[]> {
  const nodes: FileTreeNode[] = [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) {
        const children = await buildFileTree(path.join(dirPath, entry.name));
        nodes.push({ name: entry.name, type: "directory", children });
      } else {
        nodes.push({ name: entry.name, type: "file" });
      }
    }
  } catch {}
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const skillName = request.nextUrl.searchParams.get("name");
  const source = request.nextUrl.searchParams.get("source");
  const pluginName = request.nextUrl.searchParams.get("plugin");
  const refFile = request.nextUrl.searchParams.get("file");

  if (skillName) {
    if (!isSafePathSegment(skillName)) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    // Read a specific reference file
    if (refFile) {
      if (refFile.includes("..")) {
        return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
      }
      let basePath: string;
      if (source === "custom") {
        basePath = path.join(claudeHome, "skills", skillName);
      } else {
        const marketplace = request.nextUrl.searchParams.get("marketplace");
        if (!marketplace || !pluginName || !isSafePathSegment(marketplace) || !isSafePathSegment(pluginName)) {
          return NextResponse.json({ error: "Invalid params" }, { status: 400 });
        }
        basePath = await findPluginSkillDir(claudeHome, marketplace, pluginName, skillName);
      }
      const filePath = path.join(basePath, refFile);
      // Ensure resolved path stays within basePath
      if (!path.resolve(filePath).startsWith(path.resolve(basePath))) {
        return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
      }
      try {
        const content = await readFile(filePath, "utf-8");
        return NextResponse.json({ content, fileName: refFile });
      } catch {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
    }

    let skillPath: string;
    let dirPath: string;
    if (source === "custom") {
      dirPath = path.join(claudeHome, "skills", skillName);
      const files = await readdir(dirPath).catch(() => []);
      const mdFiles = files.filter((f: string) => f.endsWith(".md")).sort();
      const mdFile = mdFiles.includes("SKILL.md") ? "SKILL.md" : mdFiles[0];
      skillPath = mdFile ? path.join(dirPath, mdFile) : path.join(dirPath, "SKILL.md");
    } else {
      const marketplace = request.nextUrl.searchParams.get("marketplace");
      if (!marketplace || !pluginName) {
        return NextResponse.json({ error: "marketplace and plugin required" }, { status: 400 });
      }
      if (!isSafePathSegment(marketplace) || !isSafePathSegment(pluginName)) {
        return NextResponse.json({ error: "Invalid marketplace or plugin" }, { status: 400 });
      }
      skillPath = await findPluginSkillPath(claudeHome, marketplace, pluginName, skillName);
      dirPath = path.dirname(skillPath);
    }

    const result = await readMarkdownFile(skillPath);
    if (result.data) {
      let rawContent = "";
      try { rawContent = await readFile(skillPath, "utf-8"); } catch {}
      const fileTree = await buildFileTree(dirPath);
      return NextResponse.json({ content: result.data.content, frontmatter: result.data.frontmatter, rawContent, fileTree });
    }
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const { readFullConfig } = await import("@/lib/config-reader");
  const config = await readFullConfig(claudeHome);
  return NextResponse.json(config.skills);
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const { name, content, file: refFile } = await request.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const dirPath = path.join(claudeHome, "skills", name);
  await mkdir(dirPath, { recursive: true });

  // Create a reference file inside the skill directory
  if (refFile) {
    if (typeof refFile !== "string" || refFile.includes("..")) {
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }
    const filePath = path.join(dirPath, refFile);
    if (!path.resolve(filePath).startsWith(path.resolve(dirPath))) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }
    // Ensure parent dirs exist for nested paths
    await mkdir(path.dirname(filePath), { recursive: true });
    try {
      await writeFile(filePath, content ?? "", "utf-8");
      return NextResponse.json({ success: true });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  const filePath = path.join(dirPath, "SKILL.md");
  try {
    await writeFile(filePath, content ?? "", "utf-8");
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const name = request.nextUrl.searchParams.get("name");
  const refFile = request.nextUrl.searchParams.get("file");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const dirPath = path.join(claudeHome, "skills", name);

  // Delete a specific reference file
  if (refFile) {
    if (refFile.includes("..")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }
    const filePath = path.join(dirPath, refFile);
    if (!path.resolve(filePath).startsWith(path.resolve(dirPath))) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }
    try {
      const { unlink } = await import("fs/promises");
      await unlink(filePath);
      return NextResponse.json({ success: true });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  try {
    await rm(dirPath, { recursive: true, force: true });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  const claudeHome = getClaudeHomeFromRequest(request);
  const { name, content, file: refFile } = await request.json();

  if (!name || typeof content !== "string") {
    return NextResponse.json({ error: "name and content required" }, { status: 400 });
  }
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const dirPath = path.join(claudeHome, "skills", name);

  // Update a reference file
  if (refFile) {
    if (typeof refFile !== "string" || refFile.includes("..")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }
    const filePath = path.join(dirPath, refFile);
    if (!path.resolve(filePath).startsWith(path.resolve(dirPath))) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }
    try {
      await writeFile(filePath, content, "utf-8");
      return NextResponse.json({ success: true });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  try {
    const files = await readdir(dirPath);
    const mdFiles = files.filter((f: string) => f.endsWith(".md")).sort();
    const mdFile = mdFiles.includes("SKILL.md") ? "SKILL.md" : mdFiles[0];
    if (!mdFile) {
      return NextResponse.json({ error: "Skill file not found" }, { status: 404 });
    }

    const userDataPath = request.headers.get("x-user-data-path");
    const profileId = request.headers.get("x-profile-id");

    if (userDataPath && profileId && process.env.HARNESS_HUB_VERSION_HISTORY !== "0") {
      const { writeItem } = await import("@/lib/versioned-write");
      await writeItem({
        versionBase: path.join(userDataPath, "versions", profileId),
        homePath: claudeHome,
        profileId,
        kind: "skill",
        name,
        fileName: mdFile,
        content,
        source: "harness-hub",
      });
    } else {
      await writeFile(path.join(dirPath, mdFile), content, "utf-8");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function findPluginSkillDir(
  claudeHome: string,
  marketplace: string,
  pluginName: string,
  skillName: string
): Promise<string> {
  const pluginDir = path.join(claudeHome, "plugins", "cache", marketplace, pluginName);
  try {
    const versions = await readdir(pluginDir, { withFileTypes: true });
    const latest = versions
      .filter((v) => v.isDirectory())
      .map((v) => v.name)
      .sort()
      .pop();
    if (latest) return path.join(pluginDir, latest, "skills", skillName);
  } catch {}
  return "";
}

function isSafePathSegment(segment: string): boolean {
  return !segment.includes("..") && !segment.includes("/") && !segment.includes("\\");
}

async function findPluginSkillPath(
  claudeHome: string,
  marketplace: string,
  pluginName: string,
  skillName: string
): Promise<string> {
  const pluginDir = path.join(claudeHome, "plugins", "cache", marketplace, pluginName);
  try {
    const versions = await readdir(pluginDir, { withFileTypes: true });
    const latest = versions
      .filter((v) => v.isDirectory())
      .map((v) => v.name)
      .sort()
      .pop();
    if (!latest) return "";
    const skillDir = path.join(pluginDir, latest, "skills", skillName);
    const files = await readdir(skillDir);
    const mdFile = files.find((f: string) => f.endsWith(".md") && !f.startsWith("."));
    if (mdFile) return path.join(skillDir, mdFile);
  } catch {}
  return "";
}
