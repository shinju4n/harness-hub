import { readdir } from "fs/promises";
import path from "path";
import { readJsonFile } from "./file-ops";

export interface SessionInfo {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint: string;
  fileName: string;
}

export async function readSessions(claudeHome: string): Promise<SessionInfo[]> {
  const sessionsDir = path.join(claudeHome, "sessions");

  let files: string[];
  try {
    files = await readdir(sessionsDir);
  } catch {
    return [];
  }

  const candidates = files.filter(
    (f) => f.endsWith(".json") && !f.startsWith(".")
  );

  // Parse session files in parallel — a few hundred small JSONs otherwise
  // serialize into a visible stall on slow disks.
  const parsed = await Promise.all(
    candidates.map(async (file): Promise<SessionInfo | null> => {
      const result = await readJsonFile<Partial<SessionInfo>>(path.join(sessionsDir, file));
      if (!result.data) return null;
      const d = result.data;
      if (typeof d.pid !== "number" || typeof d.sessionId !== "string") return null;
      return {
        pid: d.pid,
        sessionId: d.sessionId,
        cwd: d.cwd ?? "",
        startedAt: typeof d.startedAt === "number" ? d.startedAt : 0,
        kind: d.kind ?? "",
        entrypoint: d.entrypoint ?? "",
        fileName: file,
      };
    })
  );

  return parsed
    .filter((s): s is SessionInfo => s !== null)
    .sort((a, b) => b.startedAt - a.startedAt);
}
