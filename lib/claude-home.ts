import { access } from "fs/promises";
import { existsSync, realpathSync } from "fs";
import path from "path";
import os from "os";

/**
 * Determine whether a user-supplied Claude home path is safe to operate on.
 *
 * The path comes from the `x-claude-home` request header, which means it is
 * untrusted input. Without validation, a caller could point the app at
 * `/etc/something/.claude` and drive arbitrary reads/writes through the
 * scope APIs. We require the resolved path (after symlink resolution if the
 * path exists) to live under either the user's home directory or the OS
 * temporary directory (for tests), or an explicit allow-list provided via
 * the `HARNESS_HUB_ALLOWED_HOMES` env var (colon-separated absolute paths).
 */
function validateOverridePath(resolved: string): void {
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
    for (const entry of allowList.split(":")) {
      if (entry) bases.push(path.resolve(entry));
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
      `Claude home path is outside the allowed base directories: ${resolved}`
    );
  }
}

export function getClaudeHome(override?: string | null): string {
  if (override && override !== "auto") {
    if (!path.isAbsolute(override)) {
      throw new Error("Claude home path must be absolute");
    }
    let resolved = path.resolve(override);
    // If path doesn't end with .claude, check if .claude subdir exists
    if (!resolved.endsWith(".claude")) {
      const withClaude = path.join(resolved, ".claude");
      try {
        if (existsSync(withClaude)) {
          resolved = withClaude;
        }
      } catch {}
    }
    validateOverridePath(resolved);
    return resolved;
  }

  if (process.env.CLAUDE_HOME) {
    return process.env.CLAUDE_HOME;
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
