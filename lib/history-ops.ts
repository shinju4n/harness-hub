import { createReadStream } from "fs";
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
  let stream;
  try {
    stream = createReadStream(filePath, { encoding: "utf-8" });
  } catch {
    return;
  }

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
  } finally {
    rl.close();
    stream.destroy();
  }
}

export async function readHistory(claudeHome: string, query: HistoryQuery): Promise<HistoryPage> {
  const all: HistoryEntry[] = [];
  try {
    for await (const entry of iterateHistory(claudeHome)) {
      if (query.project && entry.project !== query.project) continue;
      all.push(entry);
    }
  } catch {
    return { entries: [], total: 0 };
  }

  // Newest-first: JSONL is append-only so reverse is newest.
  all.reverse();
  const offset = query.offset ?? 0;
  const entries = all.slice(offset, offset + query.limit);
  return { entries, total: all.length };
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
