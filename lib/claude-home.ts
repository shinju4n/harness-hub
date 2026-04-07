import { access } from "fs/promises";
import { statSync, realpathSync } from "fs";
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
function collectAllowedBases(): string[] {
  const bases: string[] = [];

  // Lexical homedir and its realpath — on some NFS/enterprise setups the
  // user's `$HOME` is itself a symlink to the canonical path.
  bases.push(os.homedir());
  try {
    bases.push(realpathSync(os.homedir()));
  } catch {
    // ignore
  }

  bases.push(os.tmpdir());
  try {
    bases.push(realpathSync(os.tmpdir()));
  } catch {
    // ignore
  }

  const allowList = process.env.HARNESS_HUB_ALLOWED_HOMES;
  if (allowList) {
    for (const entry of allowList.split(path.delimiter)) {
      const trimmed = entry.trim();
      if (!trimmed || !path.isAbsolute(trimmed)) continue;
      bases.push(path.resolve(trimmed));
      try {
        bases.push(realpathSync(trimmed));
      } catch {
        // ignore
      }
    }
  }

  return bases;
}

function validateAgainstBases(probe: string, source: "override" | "env"): void {
  const bases = collectAllowedBases();
  const inside = bases.some((base) => {
    if (!base) return false;
    const relative = path.relative(base, probe);
    return !relative.startsWith("..") && !path.isAbsolute(relative);
  });
  if (!inside) {
    throw new Error(
      `Claude home path is outside the allowed base directories (${source}): ${probe}`
    );
  }
}

function resolveAndValidate(raw: string, source: "override" | "env"): string {
  if (typeof raw !== "string") {
    throw new Error(`Claude home path must be a string (${source})`);
  }
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
    } catch {
      // No `.claude` subdir — keep the original path.
    }
  }

  // Canonicalize: if the path exists, use its realpath so symlinks cannot
  // escape the allow-list after validation. If it doesn't exist yet (first
  // run), fall back to the lexical form.
  let canonical = resolved;
  try {
    canonical = realpathSync(resolved);
  } catch {
    // Path does not exist yet.
  }

  validateAgainstBases(canonical, source);
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
