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
 * the unvalidated case: profile values come from the user's own settings in
 * the renderer, which is mostly trusted but not fully (a compromised renderer
 * could pass arbitrary paths through the IPC boundary), so we apply basic
 * normalization and traversal guards here.
 *
 * Resolution rules:
 * - `"auto"`, null, empty, or invalid input → `os.homedir()/.claude` (default)
 * - Absolute path containing `\0` or path traversal (`..`) → default
 * - Absolute path ending in `.claude` → returned as-is
 * - Absolute path whose `.claude` subdir exists on disk → `<path>/.claude`
 * - Absolute path without a `.claude` subdir → **returned as-is**. The caller
 *   (`createDefaultPtyFactory`) has a load-bearing `existsSync` fallback that
 *   catches stale/missing paths and drops to the user's home, so this branch
 *   is safe: either the path exists (shell opens there) or the downstream
 *   fallback triggers (shell opens in home). We do NOT try to "helpfully"
 *   create missing `.claude` dirs here.
 */
export function resolveClaudeHome(homePath: string | null | undefined): string {
  const defaultHome = path.join(os.homedir(), ".claude");
  if (!homePath || homePath === "auto") {
    return defaultHome;
  }
  if (!path.isAbsolute(homePath)) {
    return defaultHome;
  }
  // Reject NUL bytes and any path that doesn't normalize to itself (i.e.,
  // contains `..` segments or redundant separators). Prevents a compromised
  // renderer from escaping via IPC to spawn a shell in an arbitrary directory.
  if (homePath.includes("\0") || path.normalize(homePath) !== homePath) {
    return defaultHome;
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
