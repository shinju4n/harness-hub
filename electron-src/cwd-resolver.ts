import path from "path";
import os from "os";
import { existsSync } from "fs";

/**
 * Pages whose first path segment maps directly to a `<claudeHome>/<segment>`
 * directory. Everything else falls back to the claude home root.
 */
const DIRECT_MAPPINGS = new Set([
  "hooks",
  "skills",
  "commands",
  "agents",
  "plugins",
  "mcp",
  "rules",
  "memory",
]);

/**
 * Resolves a profile's stored `homePath` setting to an absolute `.claude`
 * directory. Mirrors the behavior of `lib/claude-home.ts::getClaudeHome` for
 * the unvalidated/trusted case (the profile value comes from the user's own
 * settings, not from an untrusted request).
 *
 * - `"auto"` or null/empty → `os.homedir()/.claude`
 * - Absolute path ending in `.claude` → as-is
 * - Absolute path to a parent dir that contains a `.claude` subdir → appended
 * - Absolute path that doesn't contain `.claude` → as-is (user intent)
 * - Non-absolute (invalid) → default `os.homedir()/.claude`
 */
export function resolveClaudeHome(homePath: string | null | undefined): string {
  if (!homePath || homePath === "auto") {
    return path.join(os.homedir(), ".claude");
  }
  if (!path.isAbsolute(homePath)) {
    return path.join(os.homedir(), ".claude");
  }
  if (homePath.endsWith(".claude")) {
    return homePath;
  }
  const withClaude = path.join(homePath, ".claude");
  if (existsSync(withClaude)) {
    return withClaude;
  }
  return homePath;
}

/**
 * Maps a Next.js pathname to the working directory for a terminal opened from
 * that page, anchored under the given Claude home. Pure function — no I/O.
 */
export function resolveTerminalCwd(claudeHome: string, pathname: string): string {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (firstSegment && DIRECT_MAPPINGS.has(firstSegment)) {
    return path.join(claudeHome, firstSegment);
  }
  return claudeHome;
}
