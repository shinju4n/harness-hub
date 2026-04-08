import { readdir, lstat, unlink } from "fs/promises";
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

  // Skip dotfiles: Claude Code normally writes `<pid>.json` /
  // `<sessionId>.json`, and stray `.tmp.json` partial writes (or editor
  // swap files) should never appear in the UI.
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

function isSafeSessionFileName(fileName: string): boolean {
  if (!fileName || fileName.length > 255) return false;
  if (fileName.startsWith(".")) return false;
  if (!fileName.endsWith(".json")) return false;
  // Disallow path traversal and any directory separator.
  return /^[A-Za-z0-9_-]+\.json$/.test(fileName);
}

export interface BulkDeleteResult {
  deleted: number;
  oldest: number | null;
  newest: number | null;
}

/**
 * Preview or execute bulk delete of sessions older than `olderThanMs`
 * milliseconds. Pass `null` for `olderThanMs` to target all sessions.
 * When `dryRun` is true, no files are removed — only the count/range is
 * returned so the UI can show a confirmation prompt.
 */
export async function bulkDeleteSessions(
  claudeHome: string,
  olderThanMs: number | null,
  dryRun: boolean
): Promise<BulkDeleteResult> {
  const sessions = await readSessions(claudeHome);
  const now = Date.now();
  const targets = sessions.filter((s) => {
    if (!isSafeSessionFileName(s.fileName)) return false;
    if (olderThanMs === null) return true;
    return s.startedAt > 0 && now - s.startedAt > olderThanMs;
  });

  const timestamps = targets.map((s) => s.startedAt).filter((t) => t > 0);
  const oldest = timestamps.length ? Math.min(...timestamps) : null;
  const newest = timestamps.length ? Math.max(...timestamps) : null;

  if (!dryRun) {
    await Promise.all(
      targets.map((s) => deleteSession(claudeHome, s.fileName).catch(() => false))
    );
  }

  return { deleted: targets.length, oldest, newest };
}

/**
 * Deletes a session file by basename. Caller passes the bare file name as
 * returned in `SessionInfo.fileName` (e.g. `12345.json`); we never accept
 * a relative or absolute path.
 *
 * Refuses to follow symlinks so a planted link inside ~/.claude/sessions
 * cannot be used to delete arbitrary files.
 */
export async function deleteSession(claudeHome: string, fileName: string): Promise<boolean> {
  if (!isSafeSessionFileName(fileName)) {
    throw new Error(`Invalid session file name: ${fileName}`);
  }
  const filePath = path.join(claudeHome, "sessions", fileName);

  try {
    const info = await lstat(filePath);
    if (info.isSymbolicLink()) {
      throw new Error(`Refusing to operate on symlink: ${filePath}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }

  try {
    await unlink(filePath);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}
