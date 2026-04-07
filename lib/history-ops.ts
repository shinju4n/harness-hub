import { createReadStream, existsSync } from "fs";
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
  // Ring buffer holds only the last `offset + limit` matching entries, so
  // memory stays bounded regardless of file size.
  const capacity = offset + query.limit;
  const buffer: HistoryEntry[] = [];
  let total = 0;

  try {
    for await (const entry of iterateHistory(claudeHome)) {
      if (query.project && entry.project !== query.project) continue;
      total += 1;
      if (capacity <= 0) continue;
      buffer.push(entry);
      if (buffer.length > capacity) {
        buffer.shift();
      }
    }
  } catch {
    return { entries: [], total: 0 };
  }

  // buffer now holds the last `capacity` chronological entries (oldest →
  // newest within the window). Reverse to newest-first, then drop the
  // `offset` leading items to produce the requested page.
  buffer.reverse();
  const entries = buffer.slice(offset, offset + query.limit);
  return { entries, total };
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
