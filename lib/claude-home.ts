import { access } from "fs/promises";
import path from "path";

export function getClaudeHome(override?: string | null): string {
  if (override && override !== "auto") {
    let resolved = path.resolve(override);
    if (!path.isAbsolute(resolved)) {
      throw new Error("Claude home path must be absolute");
    }
    // If path doesn't end with .claude, check if .claude subdir exists
    if (!resolved.endsWith(".claude")) {
      const withClaude = path.join(resolved, ".claude");
      try {
        const fs = require("fs");
        if (fs.existsSync(withClaude)) {
          resolved = withClaude;
        }
      } catch {}
    }
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
