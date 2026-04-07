import { createReadStream, existsSync } from "fs";
import { readFile, writeFile, rename } from "fs/promises";
import { createInterface } from "readline";
import path from "path";

export interface HistoryEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId: string;
  pastedContents?: Record<string, unknown>;
}

export interface HistoryQuery {
  limit: number;
  offset?: number;
  project?: string;
}

export interface HistoryPage {
  entries: HistoryEntry[];
  total: number;
}

async function* iterateHistory(claudeHome: string): AsyncGenerator<HistoryEntry> {
  const filePath = path.join(claudeHome, "history.jsonl");
  if (!existsSync(filePath)) return;

  const stream = createReadStream(filePath, { encoding: "utf-8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as Partial<HistoryEntry>;
        if (typeof parsed.display !== "string") continue;
        yield {
          display: parsed.display,
          timestamp: typeof parsed.timestamp === "number" ? parsed.timestamp : 0,
          project: parsed.project ?? "",
          sessionId: parsed.sessionId ?? "",
          pastedContents: parsed.pastedContents,
        };
      } catch {
        // skip malformed line
      }
    }
  } catch {
    // stream error (ENOENT on a race, disk unplugged, etc.) — return what we
    // have collected so far rather than propagating.
    return;
  } finally {
    rl.close();
    stream.destroy();
  }
}

export async function readHistory(claudeHome: string, query: HistoryQuery): Promise<HistoryPage> {
  const offset = Math.max(0, query.offset ?? 0);
  const capacity = offset + query.limit;

  // True circular buffer: constant-time insert, O(capacity) drain. Avoids
  // the O(n × capacity) cost of Array#shift on pathologically large files.
  const ring: (HistoryEntry | undefined)[] = new Array(capacity);
  let head = 0;    // next insert slot
  let size = 0;    // number of valid entries currently in the ring
  let total = 0;

  try {
    for await (const entry of iterateHistory(claudeHome)) {
      if (query.project && entry.project !== query.project) continue;
      total += 1;
      if (capacity <= 0) continue;
      ring[head] = entry;
      head = (head + 1) % capacity;
      if (size < capacity) size += 1;
    }
  } catch {
    return { entries: [], total: 0 };
  }

  if (size === 0) return { entries: [], total };

  // The ring now holds the last `size` chronological entries. The oldest
  // sits at `(head - size + capacity) % capacity`. Drain into a newest-first
  // array for slicing.
  const newestFirst: HistoryEntry[] = new Array(size);
  for (let i = 0; i < size; i += 1) {
    const chronoIndex = (head - size + i + capacity) % capacity;
    // Reverse while we copy: oldest chrono → end of result, newest → start.
    newestFirst[size - 1 - i] = ring[chronoIndex]!;
  }

  const entries = newestFirst.slice(offset, offset + query.limit);
  return { entries, total };
}

export interface HistoryEntryKey {
  timestamp: number;
  sessionId: string;
  display: string;
}

/**
 * Removes every line from history.jsonl whose parsed entry matches the given
 * (timestamp, sessionId, display) tuple. JSONL has no stable record id, so
 * exact-match on these three fields is the closest we can get to a primary
 * key. Malformed lines are preserved verbatim — we only touch lines we can
 * fully understand.
 *
 * Returns the number of entries removed (0 when nothing matched, including
 * the case where the history file does not exist).
 *
 * Implementation: read entire file (currently ~MB scale), filter, write
 * via tmp + rename for atomicity.
 */
export async function deleteHistoryEntry(
  claudeHome: string,
  key: HistoryEntryKey
): Promise<number> {
  const filePath = path.join(claudeHome, "history.jsonl");
  if (!existsSync(filePath)) return 0;

  const original = await readFile(filePath, "utf-8");
  const lines = original.split("\n");
  const kept: string[] = [];
  let removed = 0;

  for (const line of lines) {
    if (!line) {
      kept.push(line);
      continue;
    }
    let parsed: Partial<HistoryEntry> | null = null;
    try {
      parsed = JSON.parse(line) as Partial<HistoryEntry>;
    } catch {
      // Malformed line — preserve verbatim, never silently drop user data.
      kept.push(line);
      continue;
    }
    if (
      parsed &&
      parsed.timestamp === key.timestamp &&
      parsed.sessionId === key.sessionId &&
      parsed.display === key.display
    ) {
      removed += 1;
      continue;
    }
    kept.push(line);
  }

  if (removed === 0) return 0;

  const tmpPath = filePath + ".tmp";
  await writeFile(tmpPath, kept.join("\n"), "utf-8");
  await rename(tmpPath, filePath);
  return removed;
}

export async function listHistoryProjects(claudeHome: string): Promise<string[]> {
  const seen = new Set<string>();
  try {
    for await (const entry of iterateHistory(claudeHome)) {
      if (entry.project) seen.add(entry.project);
    }
  } catch {
    return [];
  }
  return Array.from(seen);
}
