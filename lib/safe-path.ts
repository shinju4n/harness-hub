import { realpathSync } from "fs";
import path from "path";
import { isWebMode } from "./mode";
import { getClaudeHome } from "./claude-home";

export class PathConfinementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathConfinementError";
  }
}

/**
 * Hard-blocked system paths that must never be accessible in web mode,
 * regardless of CLAUDE_HOME configuration.
 */
const SYSTEM_PATH_PREFIXES = [
  "/etc",
  "/proc",
  "/sys",
  "/dev",
  "/root",
  "/boot",
  "/sbin",
];

/**
 * Assert that `targetPath` is within the configured CLAUDE_HOME directory.
 *
 * - In **desktop** mode this function is a no-op: the single-user desktop
 *   threat model doesn't require path confinement, and blocking external
 *   drives / NAS mounts would be a regression.
 * - In **web** mode the function resolves `targetPath` via `realpathSync`
 *   (following symlinks) and verifies it falls under the canonical
 *   CLAUDE_HOME prefix. It also unconditionally blocks system paths.
 *
 * Throws `PathConfinementError` on violations.
 */
/**
 * Check a resolved path against system path prefixes. If the path is or
 * starts with any blocked prefix, throw PathConfinementError.
 */
function assertNotSystemPath(resolvedPath: string): void {
  for (const prefix of SYSTEM_PATH_PREFIXES) {
    if (resolvedPath === prefix || resolvedPath.startsWith(prefix + "/")) {
      throw new PathConfinementError(
        `Access denied: system path "${resolvedPath}" is blocked in web mode`,
      );
    }
  }
}

export function assertWithinClaudeHome(targetPath: string): void {
  if (!isWebMode()) return;

  const resolved = path.resolve(targetPath);

  // Block system paths on the lexical form first (fast reject)
  assertNotSystemPath(resolved);

  const claudeHome = getClaudeHome();
  let canonicalHome: string;
  try {
    canonicalHome = realpathSync(claudeHome);
  } catch {
    canonicalHome = path.resolve(claudeHome);
  }

  let canonicalTarget: string;
  try {
    canonicalTarget = realpathSync(resolved);
  } catch {
    canonicalTarget = resolved;
  }

  // Block system paths on the canonical form too — this catches symlinks
  // inside CLAUDE_HOME that point to system paths (e.g. ~/.claude/evil -> /etc)
  assertNotSystemPath(canonicalTarget);

  if (
    canonicalTarget !== canonicalHome &&
    !canonicalTarget.startsWith(canonicalHome + "/")
  ) {
    throw new PathConfinementError(
      `Access denied: "${canonicalTarget}" is outside CLAUDE_HOME ("${canonicalHome}") in web mode`,
    );
  }
}
