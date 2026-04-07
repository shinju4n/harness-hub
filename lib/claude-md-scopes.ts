import { readFile, writeFile, access } from "fs/promises";
import path from "path";

export type ClaudeMdScopeId = "user" | "project" | "local" | "org";

export interface ClaudeMdScope {
  id: ClaudeMdScopeId;
  label: string;
  description: string;
  filePath: string;
  exists: boolean;
  writable: boolean;
}

export interface ClaudeMdScopeContent {
  id: ClaudeMdScopeId;
  filePath: string;
  content: string;
  exists: boolean;
  writable: boolean;
}

const SCOPE_ORDER: ClaudeMdScopeId[] = ["user", "project", "local", "org"];

function getOrgClaudeMdPath(): string {
  if (process.platform === "darwin") {
    return "/Library/Application Support/ClaudeCode/CLAUDE.md";
  }
  if (process.platform === "win32") {
    return "C:\\ProgramData\\ClaudeCode\\CLAUDE.md";
  }
  return "/etc/claude-code/CLAUDE.md";
}

function resolveScopePath(id: ClaudeMdScopeId, claudeHome: string): string {
  const parent = path.dirname(claudeHome);
  switch (id) {
    case "user":
      return path.join(claudeHome, "CLAUDE.md");
    case "project":
      return path.join(parent, "CLAUDE.md");
    case "local":
      return path.join(parent, "CLAUDE.local.md");
    case "org":
      return getOrgClaudeMdPath();
  }
}

function describeScope(id: ClaudeMdScopeId): { label: string; description: string; writable: boolean } {
  switch (id) {
    case "user":
      return { label: "User", description: "Personal instructions loaded in every session (~/.claude/CLAUDE.md)", writable: true };
    case "project":
      return { label: "Project", description: "Project-specific instructions (parent/CLAUDE.md)", writable: true };
    case "local":
      return { label: "Local", description: "Local override, typically gitignored (parent/CLAUDE.local.md)", writable: true };
    case "org":
      return { label: "Organization", description: "Organization-wide instructions (read-only)", writable: false };
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listClaudeMdScopes(claudeHome: string): Promise<ClaudeMdScope[]> {
  const scopes = await Promise.all(
    SCOPE_ORDER.map(async (id) => {
      const filePath = resolveScopePath(id, claudeHome);
      const meta = describeScope(id);
      const exists = await fileExists(filePath);
      return {
        id,
        label: meta.label,
        description: meta.description,
        filePath,
        exists,
        writable: meta.writable,
      };
    })
  );
  return scopes;
}

function assertKnownScope(id: string): asserts id is ClaudeMdScopeId {
  if (!SCOPE_ORDER.includes(id as ClaudeMdScopeId)) {
    throw new Error(`Unknown CLAUDE.md scope: ${id}`);
  }
}

export async function readClaudeMdScope(claudeHome: string, id: ClaudeMdScopeId): Promise<ClaudeMdScopeContent> {
  assertKnownScope(id);
  const filePath = resolveScopePath(id, claudeHome);
  const meta = describeScope(id);
  try {
    const content = await readFile(filePath, "utf-8");
    return { id, filePath, content, exists: true, writable: meta.writable };
  } catch {
    return { id, filePath, content: "", exists: false, writable: meta.writable };
  }
}

export async function writeClaudeMdScope(
  claudeHome: string,
  id: ClaudeMdScopeId,
  content: string
): Promise<void> {
  assertKnownScope(id);
  const meta = describeScope(id);
  if (!meta.writable) {
    throw new Error(`Scope "${id}" is read-only`);
  }
  const filePath = resolveScopePath(id, claudeHome);
  await writeFile(filePath, content, "utf-8");
}
