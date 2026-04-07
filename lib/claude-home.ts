import { access } from "fs/promises";
import { existsSync, realpathSync } from "fs";
import path from "path";
import os from "os";

/**
 * Determine whether a user-supplied Claude home path is safe to operate on.
 *
 * Both the `x-claude-home` request header and the `CLAUDE_HOME` env var are
 * treated as untrusted: headers come from any local client and env vars can
 * be set by any parent process / `.env` leak. We require the resolved path
 * (after symlink resolution when it exists) to live under:
 *   - the user's home directory
 *   - the OS temporary directory (for tests)
 *   - any explicit absolute path in `HARNESS_HUB_ALLOWED_HOMES`
 *     (parsed with `path.delimiter` — `:` on posix, `;` on win32).
 *
 * NOTE on residual TOCTOU: we realpath at validation time, but any later
 * `writeFile` re-resolves the path lexically, so a symlink swap between
 * validation and write can still escape. Callers writing to these paths
 * should realpath the final target at write time (see claude-md-scopes).
 */
function validateOverridePath(resolved: string, source: "override" | "env"): void {
  if (resolved.includes("\u0000")) {
    throw new Error("Claude home path contains invalid characters");
  }

  const bases = [os.homedir(), os.tmpdir()];

  // realpath of tmpdir on macOS is /private/var/... so also allow the realpath.
  try {
    bases.push(realpathSync(os.tmpdir()));
  } catch {
    // ignore
  }

  const allowList = process.env.HARNESS_HUB_ALLOWED_HOMES;
  if (allowList) {
    for (const entry of allowList.split(path.delimiter)) {
      const trimmed = entry.trim();
      if (trimmed && path.isAbsolute(trimmed)) {
        bases.push(path.resolve(trimmed));
      }
    }
  }

  // If the path exists, use its realpath to defeat symlink escapes.
  let probe = resolved;
  try {
    probe = realpathSync(resolved);
  } catch {
    // Path does not exist yet — fall back to the lexical form.
  }

  const isInside = bases.some((base) => {
    if (!base) return false;
    const relative = path.relative(base, probe);
    return !relative.startsWith("..") && !path.isAbsolute(relative);
  });

  if (!isInside) {
    throw new Error(
      `Claude home path is outside the allowed base directories (${source}): ${resolved}`
    );
  }
}

function resolveAndValidate(raw: string, source: "override" | "env"): string {
  if (!path.isAbsolute(raw)) {
    throw new Error(`Claude home path must be absolute (${source}): ${raw}`);
  }
  let resolved = path.resolve(raw);
  // If path doesn't end with .claude, check if .claude subdir exists
  if (!resolved.endsWith(".claude")) {
    const withClaude = path.join(resolved, ".claude");
    try {
      if (existsSync(withClaude)) {
        resolved = withClaude;
      }
    } catch {}
  }
  validateOverridePath(resolved, source);
  return resolved;
}

export function getClaudeHome(override?: string | null): string {
  if (override && override !== "auto") {
    return resolveAndValidate(override, "override");
  }

  if (process.env.CLAUDE_HOME) {
    return resolveAndValidate(process.env.CLAUDE_HOME, "env");
  }

  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    throw new Error("Cannot detect home directory");
  }
  return path.join(home, ".claude");
}

export function getClaudeHomeFromRequest(request: Request): string {
  const override = request.headers.get("x-claude-home");
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
