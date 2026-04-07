import { readFile, writeFile, access, stat, lstat } from "fs/promises";
import { realpathSync } from "fs";
import path from "path";

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
  /** Canonical (realpath'd) absolute path. Guaranteed to exist and be a directory. */
  absolute: string;
}
interface InvalidProjectRoot {
  ok: false;
  reason: string;
}

/**
 * Validates and canonicalizes a user-supplied project root path.
 *
 * The returned `absolute` path has been realpath-resolved so subsequent
 * lexical joins (`path.join(absolute, "CLAUDE.md")`) cannot traverse into
 * another directory via an intermediate symlink. Callers must ALSO guard
 * against the final file being a symlink at write time (see writeClaudeMdScope).
 */
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
  let canonical: string;
  try {
    canonical = realpathSync(projectRoot);
  } catch {
    return { ok: false, reason: "Project root not found" };
  }
  return { ok: true, absolute: canonical };
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

  // Scope invariant: each writable scope must stay inside its own root.
  //   - user scope → under claudeHome
  //   - project/local scope → under the realpath'd projectRoot
  // projectRoot was already canonicalized in validateProjectRoot, so
  // path.dirname(filePath) of a project write is ALWAYS `projectRoot` by
  // construction. For user scope, claudeHome is already validated at the
  // request boundary (getClaudeHome). So the only residual threat is a
  // symlink planted at the final file path between validation and write;
  // we defeat that with an lstat check.
  //
  // NOTE: a narrow TOCTOU window remains between lstat and writeFile. A
  // racing attacker with write access to the parent directory could plant
  // a symlink after the check. Closing that window requires open(...,
  // O_NOFOLLOW), which Node's high-level fs API does not expose cleanly
  // across platforms. The attacker would already need write access to the
  // user's project or claude home directory, at which point they can
  // modify the target anyway.
  try {
    const info = await lstat(filePath);
    if (info.isSymbolicLink()) {
      throw new Error(`Refusing to write: target is a symlink (${filePath})`);
    }
  } catch (err) {
    // ENOENT is fine — we're creating a new file.
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  await writeFile(filePath, content, "utf-8");
}
