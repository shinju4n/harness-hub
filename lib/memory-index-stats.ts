// Claude Code memory loading limits.
// MEMORY.md is auto-loaded on session start; everything over ~200 lines / 25KB
// is truncated, so surface the usage so power users can prune.
export const MEMORY_INDEX_LINE_LIMIT = 200;
export const MEMORY_INDEX_BYTE_LIMIT = 25 * 1024; // 25KB

export interface MemoryIndexStats {
  exists: boolean;
  lines: number;
  bytes: number;
  linePct: number;
  bytePct: number;
  overLineLimit: boolean;
  overByteLimit: boolean;
}

export function computeMemoryIndexStats(content: string | null): MemoryIndexStats {
  if (content == null) {
    return {
      exists: false,
      lines: 0,
      bytes: 0,
      linePct: 0,
      bytePct: 0,
      overLineLimit: false,
      overByteLimit: false,
    };
  }

  const lines = content.split("\n").length;
  const bytes = Buffer.byteLength(content, "utf-8");
  return {
    exists: true,
    lines,
    bytes,
    linePct: Math.round((lines / MEMORY_INDEX_LINE_LIMIT) * 100),
    bytePct: Math.round((bytes / MEMORY_INDEX_BYTE_LIMIT) * 100),
    overLineLimit: lines > MEMORY_INDEX_LINE_LIMIT,
    overByteLimit: bytes > MEMORY_INDEX_BYTE_LIMIT,
  };
}
