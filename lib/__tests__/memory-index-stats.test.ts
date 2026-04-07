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

  it("counts lines and bytes (logical line count, trailing newline = terminator)", () => {
    // Three lines of content ending with a newline → 3 logical lines, not 4.
    const content = "# Index\n- [a](a.md) — x\n- [b](b.md) — y\n";
    const stats = computeMemoryIndexStats(content);
    expect(stats.exists).toBe(true);
    expect(stats.lines).toBe(3);
    expect(stats.bytes).toBe(Buffer.byteLength(content, "utf-8"));
  });

  it("counts a single unterminated line as 1", () => {
    expect(computeMemoryIndexStats("hello").lines).toBe(1);
  });

  it("counts an empty string as 0 lines", () => {
    expect(computeMemoryIndexStats("").lines).toBe(0);
  });

  it("counts content without trailing newline correctly", () => {
    expect(computeMemoryIndexStats("a\nb\nc").lines).toBe(3);
  });

  it("uses utf-8 byte length (handles multibyte chars)", () => {
    const content = "한글"; // 6 bytes in UTF-8
    const stats = computeMemoryIndexStats(content);
    expect(stats.bytes).toBe(6);
  });

  it("computes percentages relative to limits", () => {
    // 100 newline-terminated lines → exactly 100 logical lines.
    const content = "x\n".repeat(100);
    const stats = computeMemoryIndexStats(content);
    expect(stats.lines).toBe(100);
    expect(stats.linePct).toBe(50);
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
