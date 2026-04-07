import { describe, it, expect } from "vitest";
import { computeMemoryIndexStats, MEMORY_INDEX_LINE_LIMIT, MEMORY_INDEX_BYTE_LIMIT } from "../memory-index-stats";

describe("computeMemoryIndexStats", () => {
  it("returns zeroed stats when content is null", () => {
    const stats = computeMemoryIndexStats(null);
    expect(stats.lines).toBe(0);
    expect(stats.bytes).toBe(0);
    expect(stats.exists).toBe(false);
    expect(stats.linePct).toBe(0);
    expect(stats.bytePct).toBe(0);
  });

  it("counts lines and bytes", () => {
    // 3 newlines → split("\n") gives 4 chunks; matches existing memory-ops convention
    const content = "# Index\n- [a](a.md) — x\n- [b](b.md) — y\n";
    const stats = computeMemoryIndexStats(content);
    expect(stats.exists).toBe(true);
    expect(stats.lines).toBe(4);
    expect(stats.bytes).toBe(Buffer.byteLength(content, "utf-8"));
  });

  it("uses utf-8 byte length (handles multibyte chars)", () => {
    const content = "한글"; // 6 bytes in UTF-8
    const stats = computeMemoryIndexStats(content);
    expect(stats.bytes).toBe(6);
  });

  it("computes percentages relative to limits", () => {
    const content = "x\n".repeat(100);
    const stats = computeMemoryIndexStats(content);
    // stats.lines is derived from split("\n"), so use it directly for the expectation
    expect(stats.linePct).toBe(Math.round((stats.lines / MEMORY_INDEX_LINE_LIMIT) * 100));
    expect(stats.bytePct).toBeGreaterThan(0);
  });

  it("flags overLineLimit when lines > 200", () => {
    const content = "x\n".repeat(MEMORY_INDEX_LINE_LIMIT + 5);
    const stats = computeMemoryIndexStats(content);
    expect(stats.overLineLimit).toBe(true);
  });

  it("flags overByteLimit when bytes > 25KB", () => {
    const content = "x".repeat(MEMORY_INDEX_BYTE_LIMIT + 1);
    const stats = computeMemoryIndexStats(content);
    expect(stats.overByteLimit).toBe(true);
  });
});
