import { readFile, writeFile, access, stat } from "fs/promises";
import { realpathSync } from "fs";
import path from "path";
import os from "os";

export type ClaudeMdScopeId = "user" | "project" | "local" | "org";

export interface ScopeResolveOptions {
  /**
   * Absolute path to the user's project root, needed to resolve `project`
   * and `local` scopes (`<root>/CLAUDE.md` and `<root>/CLAUDE.local.md`).
   * When omitted, those scopes are returned as `available: false`.
   */
  projectRoot?: string;
}

export interface ClaudeMdScope {
  id: ClaudeMdScopeId;
  label: string;
  description: string;
  filePath: string;
  exists: boolean;
  writable: boolean;
  available: boolean;
  unavailableReason?: string;
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

function describeScope(id: ClaudeMdScopeId): { label: string; description: string; writable: boolean } {
  switch (id) {
    case "user":
      return {
        label: "User",
        description: "Personal instructions loaded in every session (~/.claude/CLAUDE.md)",
        writable: true,
      };
    case "project":
      return {
        label: "Project",
        description: "Project-specific instructions (<projectRoot>/CLAUDE.md)",
        writable: true,
      };
    case "local":
      return {
        label: "Local",
        description: "Local override, typically gitignored (<projectRoot>/CLAUDE.local.md)",
        writable: true,
      };
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

interface ValidatedProjectRoot {
  ok: true;
  absolute: string;
}
interface InvalidProjectRoot {
  ok: false;
  reason: string;
}

async function validateProjectRoot(
  projectRoot: string | undefined
): Promise<ValidatedProjectRoot | InvalidProjectRoot> {
  if (!projectRoot) {
    return { ok: false, reason: "Requires a project root path" };
  }
  if (projectRoot.includes("\u0000")) {
    return { ok: false, reason: "Project root contains invalid characters" };
  }
  if (!path.isAbsolute(projectRoot)) {
    return { ok: false, reason: "Project root must be absolute" };
  }
  try {
    const s = await stat(projectRoot);
    if (!s.isDirectory()) {
      return { ok: false, reason: "Project root is not a directory" };
    }
  } catch {
    return { ok: false, reason: "Project root not found" };
  }
  return { ok: true, absolute: path.resolve(projectRoot) };
}

export async function listClaudeMdScopes(
  claudeHome: string,
  opts: ScopeResolveOptions = {}
): Promise<ClaudeMdScope[]> {
  const projectResult = await validateProjectRoot(opts.projectRoot);

  const scopes = await Promise.all(
    SCOPE_ORDER.map(async (id): Promise<ClaudeMdScope> => {
      const meta = describeScope(id);

      if (id === "user") {
        const filePath = path.join(claudeHome, "CLAUDE.md");
        return {
          id,
          label: meta.label,
          description: meta.description,
          filePath,
          exists: await fileExists(filePath),
          writable: true,
          available: true,
        };
      }

      if (id === "org") {
        const filePath = getOrgClaudeMdPath();
        return {
          id,
          label: meta.label,
          description: meta.description,
          filePath,
          exists: await fileExists(filePath),
          writable: false,
          available: true,
        };
      }

      // project or local — both need projectRoot
      if (!projectResult.ok) {
        return {
          id,
          label: meta.label,
          description: meta.description,
          filePath: "",
          exists: false,
          writable: false,
          available: false,
          unavailableReason: projectResult.reason,
        };
      }

      const fileName = id === "project" ? "CLAUDE.md" : "CLAUDE.local.md";
      const filePath = path.join(projectResult.absolute, fileName);
      return {
        id,
        label: meta.label,
        description: meta.description,
        filePath,
        exists: await fileExists(filePath),
        writable: true,
        available: true,
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

async function resolveScopeFilePath(
  id: ClaudeMdScopeId,
  claudeHome: string,
  opts: ScopeResolveOptions
): Promise<string> {
  if (id === "user") return path.join(claudeHome, "CLAUDE.md");
  if (id === "org") return getOrgClaudeMdPath();

  const projectResult = await validateProjectRoot(opts.projectRoot);
  if (!projectResult.ok) {
    throw new Error(`Cannot resolve ${id} scope: ${projectResult.reason}`);
  }
  const fileName = id === "project" ? "CLAUDE.md" : "CLAUDE.local.md";
  return path.join(projectResult.absolute, fileName);
}

export async function readClaudeMdScope(
  claudeHome: string,
  id: ClaudeMdScopeId,
  opts: ScopeResolveOptions = {}
): Promise<ClaudeMdScopeContent> {
  assertKnownScope(id);
  const filePath = await resolveScopeFilePath(id, claudeHome, opts);
  const writable = describeScope(id).writable;
  try {
    const content = await readFile(filePath, "utf-8");
    return { id, filePath, content, exists: true, writable };
  } catch {
    return { id, filePath, content: "", exists: false, writable };
  }
}

export async function writeClaudeMdScope(
  claudeHome: string,
  id: ClaudeMdScopeId,
  content: string,
  opts: ScopeResolveOptions = {}
): Promise<void> {
  assertKnownScope(id);
  const meta = describeScope(id);
  if (!meta.writable) {
    throw new Error(`Scope "${id}" is read-only`);
  }
  const filePath = await resolveScopeFilePath(id, claudeHome, opts);
  verifyWriteTargetIsSafe(filePath);
  await writeFile(filePath, content, "utf-8");
}

/**
 * Second-line TOCTOU defense: before committing a write, re-resolve the
 * parent directory via realpath and verify it still lives under an allowed
 * base. This does not eliminate the race entirely (a symlink could be
 * swapped between this check and the `writeFile` call), but it closes the
 * common window where a stale validation from request time is reused.
 */
function verifyWriteTargetIsSafe(filePath: string): void {
  const parent = path.dirname(filePath);
  let resolvedParent: string;
  try {
    resolvedParent = realpathSync(parent);
  } catch {
    // Parent does not exist; fall back to lexical check.
    resolvedParent = path.resolve(parent);
  }

  const bases = [os.homedir(), os.tmpdir()];
  try {
    bases.push(realpathSync(os.tmpdir()));
  } catch {
    // ignore
  }
  const allowList = process.env.HARNESS_HUB_ALLOWED_HOMES;
  if (allowList) {
    for (const entry of allowList.split(path.delimiter)) {
      const trimmed = entry.trim();
      if (trimmed && path.isAbsolute(trimmed)) bases.push(trimmed);
    }
  }

  const inside = bases.some((base) => {
    if (!base) return false;
    const rel = path.relative(base, resolvedParent);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  });
  if (!inside) {
    throw new Error(`Write target is outside allowed bases: ${filePath}`);
  }
}
