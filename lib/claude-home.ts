import { access } from "fs/promises";
import { statSync, realpathSync } from "fs";
import path from "path";
import { isWebMode } from "./mode";

/**
 * Determine whether a user-supplied Claude home path is safe to operate on.
 *
 * Harness Hub is a single-user desktop app: the renderer is bound to
 * `127.0.0.1`, Electron runs with `contextIsolation: true` /
 * `nodeIntegration: false`, and there is no multi-tenant boundary. The
 * realistic threat model is "the machine owner pasted a path" — not a
 * malicious remote client. So we no longer try to confine Claude home to a
 * fixed allow-list of base directories; that confinement blocked legitimate
 * setups (external drives like `/Volumes/Work/.claude`, mounted volumes like
 * `/mnt/data/.claude`, NAS / cloud-sync folders) without buying us
 * meaningful protection on a desktop app.
 *
 * What we still enforce (hygiene only):
 *   - must be a string
 *   - must be non-empty after trimming
 *   - must not contain a NUL byte
 *   - must be an absolute path
 *
 * We also continue to:
 *   - auto-append `.claude` if the caller passed a parent directory that
 *     actually contains a `.claude` subdirectory
 *   - canonicalize through `realpathSync` so symlink swaps cannot mislead
 *     downstream callers (the residual TOCTOU note in `claude-md-scopes`
 *     still applies — the realpath here is at validation time only)
 *
 * NOTE on residual TOCTOU: we realpath at validation time, but any later
 * `writeFile` re-resolves the path lexically, so a symlink swap between
 * validation and write can still escape. Callers writing to these paths
 * should realpath the final target at write time (see claude-md-scopes).
 */

/**
 * Swallow only "path does not exist" style errors from realpath; any other
 * failure (EACCES, ELOOP, ENAMETOOLONG, ...) is a genuine signal that the
 * operator needs to see, not silently discard.
 */
function isMissingPathError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

function resolveAndValidate(raw: string, source: "override" | "env"): string {
  // The TS signature already enforces `raw: string`. The `typeof` check
  // that used to live here was unreachable defensive code; rely on the
  // type system instead and start straight at the trim.
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`Claude home path is empty (${source})`);
  }
  if (trimmed.includes("\u0000")) {
    throw new Error(`Claude home path contains invalid characters (${source})`);
  }
  if (!path.isAbsolute(trimmed)) {
    throw new Error(`Claude home path must be absolute (${source}): ${trimmed}`);
  }

  let resolved = path.resolve(trimmed);

  // If the caller passed a parent dir rather than `<something>/.claude`,
  // auto-append `.claude` only if it actually exists as a subdirectory.
  // Use statSync (not existsSync) so the check follows symlinks once, and
  // immediately realpath the final target before any validation so we
  // never return an unrealpathed path the caller can race against.
  if (!resolved.endsWith(".claude")) {
    const withClaude = path.join(resolved, ".claude");
    try {
      const info = statSync(withClaude);
      if (info.isDirectory()) {
        resolved = withClaude;
      }
    } catch (err) {
      // Missing `.claude` subdir is fine — keep the original path. Any
      // other error (EACCES, ELOOP, ENAMETOOLONG) surfaces to the caller.
      if (!isMissingPathError(err)) throw err;
    }
  }

  // Canonicalize: if the path exists, use its realpath so symlinks resolve
  // to a stable target for downstream callers. If it doesn't exist yet
  // (first run), fall back to the lexical form. Any non-missing error
  // (e.g. ELOOP from a symlink cycle) is surfaced.
  let canonical = resolved;
  try {
    canonical = realpathSync(resolved);
  } catch (err) {
    if (!isMissingPathError(err)) throw err;
  }

  return canonical;
}

export function getClaudeHome(override?: string | null): string {
  if (override && override !== "auto") {
    return resolveAndValidate(override, "override");
  }

  const envValue = process.env.CLAUDE_HOME;
  if (envValue && envValue.trim()) {
    return resolveAndValidate(envValue, "env");
  }

  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    throw new Error("Cannot detect home directory");
  }
  return path.join(home, ".claude");
}

export function getClaudeHomeFromRequest(request: Request): string {
  // In web mode, ignore the x-claude-home header entirely to prevent
  // remote clients from redirecting file operations outside the
  // server-configured CLAUDE_HOME (env var only).
  const override = isWebMode()
    ? null
    : request.headers.get("x-claude-home");
  return getClaudeHome(override);
}

interface ClaudeInstallation {
  exists: boolean;
  path: string;
  os: string;
}

export async function detectClaudeInstallation(
  claudeHome?: string
): Promise<ClaudeInstallation> {
  const homePath = claudeHome ?? getClaudeHome();
  const os =
    process.platform === "win32"
      ? "Windows"
      : process.platform === "darwin"
        ? "macOS"
        : "Linux";

  try {
    await access(homePath);
    return { exists: true, path: homePath, os };
  } catch {
    return { exists: false, path: homePath, os };
  }
}
