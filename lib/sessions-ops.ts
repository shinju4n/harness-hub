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
  const sessions: SessionInfo[] = [];

  let files: string[];
  try {
    files = await readdir(sessionsDir);
  } catch {
    return [];
  }

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const result = await readJsonFile<Partial<SessionInfo>>(path.join(sessionsDir, file));
    if (!result.data) continue;
    const d = result.data;
    if (typeof d.pid !== "number" || typeof d.sessionId !== "string") continue;
    sessions.push({
      pid: d.pid,
      sessionId: d.sessionId,
      cwd: d.cwd ?? "",
      startedAt: typeof d.startedAt === "number" ? d.startedAt : 0,
      kind: d.kind ?? "",
      entrypoint: d.entrypoint ?? "",
      fileName: file,
    });
  }

  sessions.sort((a, b) => b.startedAt - a.startedAt);
  return sessions;
}
