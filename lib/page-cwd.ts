import os from "os";
import path from "path";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");

// Pages whose first path segment maps directly to a ~/.claude/<segment> directory.
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
 * Resolves the working directory for a terminal opened from a given page.
 *
 * Resolution order:
 * 1. Explicit override (e.g. session cwd, plan cwd) — wins.
 * 2. First path segment matched against DIRECT_MAPPINGS → ~/.claude/<segment>.
 * 3. Fallback → ~/.claude.
 */
export function resolvePageCwd(
  pathname: string,
  override?: string | null,
): string {
  if (override) return override;

  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (firstSegment && DIRECT_MAPPINGS.has(firstSegment)) {
    return path.join(CLAUDE_DIR, firstSegment);
  }

  return CLAUDE_DIR;
}
