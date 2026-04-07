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

  const lines = countLogicalLines(content);
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

/**
 * Counts "logical lines" the way an editor does:
 *   ""        → 0
 *   "a"       → 1
 *   "a\n"     → 1   (trailing newline is a terminator, not an empty line)
 *   "a\nb"    → 2
 *   "a\nb\n"  → 2
 */
function countLogicalLines(content: string): number {
  if (content.length === 0) return 0;
  const newlines = (content.match(/\n/g) ?? []).length;
  return content.endsWith("\n") ? newlines : newlines + 1;
}
