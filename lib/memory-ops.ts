import { readFile, writeFile, readdir, stat, mkdir, unlink } from "fs/promises";
import path from "path";
import matter from "gray-matter";

// ─── Types ───

export interface MemoryProject {
  id: string;
  path: string;
  memoryCount: number;
  hasMemoryDir: boolean;
}

export interface MemoryFile {
  fileName: string;
  name: string | null;
  description: string | null;
  type: "user" | "feedback" | "project" | "reference" | "unknown";
  body: string;
  mtime: string;
}

export interface MemoryListResult {
  memories: MemoryFile[];
  memoryIndex: string | null;
  warning?: string;
}

export interface MutationResult {
  success: boolean;
  error?: string;
  warning?: string;
}

export interface CreateMemoryInput {
  fileName: string;
  name: string;
  description: string;
  type: "user" | "feedback" | "project" | "reference" | "unknown";
  body: string;
}

export interface UpdateMemoryInput extends CreateMemoryInput {
  expectedMtime: number;
}

// ─── Helpers ───

const VALID_TYPES = new Set(["user", "feedback", "project", "reference"]);

function parseType(raw: unknown): MemoryFile["type"] {
  if (typeof raw === "string" && VALID_TYPES.has(raw)) {
    return raw as MemoryFile["type"];
  }
  return "unknown";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseMemoryFile(fileName: string, raw: string, mtime: string): MemoryFile {
  const { data: fm, content } = matter(raw);
  const hasValidFm = fm && Object.keys(fm).length > 0;
  return {
    fileName,
    name: hasValidFm && typeof fm.name === "string" ? fm.name : null,
    description: hasValidFm && typeof fm.description === "string" ? fm.description : null,
    type: hasValidFm ? parseType(fm.type) : "unknown",
    body: content.trim(),
    mtime,
  };
}

export function buildMemoryFileContent(input: {
  name: string;
  description: string;
  type: string;
  body: string;
}): string {
  return `---\nname: ${input.name}\ndescription: ${input.description}\ntype: ${input.type}\n---\n\n${input.body}\n`;
}

function buildMemoryIndexLine(input: { name: string; fileName: string; description: string }): string {
  return `- [${input.name}](${input.fileName}) — ${input.description}`;
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureMemoryDir(memDir: string): Promise<void> {
  await mkdir(memDir, { recursive: true });
  const indexPath = path.join(memDir, "MEMORY.md");
  if (!(await fileExists(indexPath))) {
    await writeFile(indexPath, "# Memory Index\n", "utf-8");
  }
}

async function addToMemoryIndex(
  memDir: string,
  input: { name: string; fileName: string; description: string }
): Promise<string | undefined> {
  const indexPath = path.join(memDir, "MEMORY.md");
  let content = "";
  try {
    content = await readFile(indexPath, "utf-8");
  } catch {
    // No MEMORY.md yet
  }
  const line = buildMemoryIndexLine(input);
  content = content.trimEnd() + "\n" + line + "\n";
  await writeFile(indexPath, content, "utf-8");

  const lineCount = content.split("\n").length;
  if (lineCount > 180) {
    return `MEMORY.md has ${lineCount} lines (exceeds 180 line limit)`;
  }
  return undefined;
}

async function updateMemoryIndex(
  memDir: string,
  input: { name: string; fileName: string; description: string }
): Promise<void> {
  const indexPath = path.join(memDir, "MEMORY.md");
  let content = "";
  try {
    content = await readFile(indexPath, "utf-8");
  } catch {
    return;
  }
  const pattern = new RegExp(`^.*\\]\\(${escapeRegExp(input.fileName)}\\).*$`, "m");
  const newLine = buildMemoryIndexLine(input);
  if (pattern.test(content)) {
    content = content.replace(pattern, newLine);
  } else {
    content = content.trimEnd() + "\n" + newLine + "\n";
  }
  await writeFile(indexPath, content, "utf-8");
}

async function removeFromMemoryIndex(memDir: string, fileName: string): Promise<void> {
  const indexPath = path.join(memDir, "MEMORY.md");
  let content = "";
  try {
    content = await readFile(indexPath, "utf-8");
  } catch {
    return;
  }
  const pattern = new RegExp(`^.*\\]\\(${escapeRegExp(fileName)}\\).*\\n?`, "m");
  content = content.replace(pattern, "");
  await writeFile(indexPath, content, "utf-8");
}

// ─── Read Functions ───

export async function listMemoryProjects(claudeHome: string): Promise<MemoryProject[]> {
  const projectsDir = path.join(claudeHome, "projects");
  if (!(await dirExists(projectsDir))) return [];

  const entries = await readdir(projectsDir, { withFileTypes: true });
  const results: MemoryProject[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projPath = path.join(projectsDir, entry.name);
    const memDir = path.join(projPath, "memory");
    const hasMem = await dirExists(memDir);
    let memoryCount = 0;

    if (hasMem) {
      const files = await readdir(memDir);
      memoryCount = files.filter(
        (f) => f.endsWith(".md") && f !== "MEMORY.md"
      ).length;
    }

    results.push({
      id: entry.name,
      path: projPath,
      memoryCount,
      hasMemoryDir: hasMem,
    });
  }

  return results;
}

export async function listMemoryFiles(
  claudeHome: string,
  projectId: string
): Promise<MemoryListResult> {
  const memDir = path.join(claudeHome, "projects", projectId, "memory");
  if (!(await dirExists(memDir))) {
    return { memories: [], memoryIndex: null };
  }

  const files = await readdir(memDir);
  const mdFiles = files.filter((f) => f.endsWith(".md"));

  let memoryIndex: string | null = null;
  const memories: MemoryFile[] = [];

  for (const fileName of mdFiles) {
    const filePath = path.join(memDir, fileName);
    const raw = await readFile(filePath, "utf-8");

    if (fileName === "MEMORY.md") {
      memoryIndex = raw;
      continue;
    }

    const fileStat = await stat(filePath);
    memories.push(parseMemoryFile(fileName, raw, fileStat.mtime.toISOString()));
  }

  return { memories, memoryIndex };
}

export async function readMemoryFile(
  claudeHome: string,
  projectId: string,
  fileName: string
): Promise<MemoryFile | null> {
  const filePath = path.join(claudeHome, "projects", projectId, "memory", fileName);
  try {
    const raw = await readFile(filePath, "utf-8");
    const fileStat = await stat(filePath);
    return parseMemoryFile(fileName, raw, fileStat.mtime.toISOString());
  } catch {
    return null;
  }
}

// ─── Write Functions ───

export async function createMemoryFile(
  claudeHome: string,
  projectId: string,
  input: CreateMemoryInput
): Promise<MutationResult> {
  try {
    const memDir = path.join(claudeHome, "projects", projectId, "memory");
    await ensureMemoryDir(memDir);

    const filePath = path.join(memDir, input.fileName);
    if (await fileExists(filePath)) {
      return { success: false, error: `File already exists: ${input.fileName}` };
    }

    const content = buildMemoryFileContent(input);
    await writeFile(filePath, content, "utf-8");

    const warning = await addToMemoryIndex(memDir, input);
    return { success: true, warning };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateMemoryFile(
  claudeHome: string,
  projectId: string,
  input: UpdateMemoryInput
): Promise<MutationResult> {
  try {
    const memDir = path.join(claudeHome, "projects", projectId, "memory");
    const filePath = path.join(memDir, input.fileName);

    const fileStat = await stat(filePath);
    if (Math.abs(fileStat.mtimeMs - input.expectedMtime) > 100) {
      return { success: false, error: "File conflict: file was modified since last read" };
    }

    const content = buildMemoryFileContent(input);
    await writeFile(filePath, content, "utf-8");

    await updateMemoryIndex(memDir, input);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteMemoryFile(
  claudeHome: string,
  projectId: string,
  fileName: string
): Promise<MutationResult> {
  try {
    const memDir = path.join(claudeHome, "projects", projectId, "memory");
    const filePath = path.join(memDir, fileName);

    if (!(await fileExists(filePath))) {
      return { success: false, error: `File not found: ${fileName}` };
    }

    await unlink(filePath);
    await removeFromMemoryIndex(memDir, fileName);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
