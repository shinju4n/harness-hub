import { access } from "fs/promises";
import path from "path";

export function getClaudeHome(): string {
  if (process.env.CLAUDE_HOME) {
    return process.env.CLAUDE_HOME;
  }

  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    throw new Error("Cannot detect home directory");
  }
  return path.join(home, ".claude");
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
