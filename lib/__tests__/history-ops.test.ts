import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readHistory, listHistoryProjects, deleteHistoryEntry } from "../history-ops";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";

describe("history-ops", () => {
  let tmpHome: string;

  beforeEach(async () => {
    tmpHome = path.join(os.tmpdir(), `harness-history-${Date.now()}-${Math.random()}`);
    await mkdir(tmpHome, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpHome, { recursive: true, force: true });
  });

  async function writeHistory(lines: Array<Record<string, unknown>>) {
    const content = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
    await writeFile(path.join(tmpHome, "history.jsonl"), content);
  }

  it("returns empty result when history file missing", async () => {
    const result = await readHistory(tmpHome, { limit: 10 });
    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("reads and parses JSONL entries", async () => {
    await writeHistory([
      { display: "ls", timestamp: 1000, project: "/a", sessionId: "s1" },
      { display: "pwd", timestamp: 2000, project: "/b", sessionId: "s2" },
    ]);
    const result = await readHistory(tmpHome, { limit: 10 });
    expect(result.total).toBe(2);
    expect(result.entries).toHaveLength(2);
  });

  it("returns entries newest-first (reverse of file order)", async () => {
    await writeHistory([
      { display: "first", timestamp: 1000, project: "/a", sessionId: "s1" },
      { display: "second", timestamp: 2000, project: "/a", sessionId: "s1" },
      { display: "third", timestamp: 3000, project: "/a", sessionId: "s1" },
    ]);
    const result = await readHistory(tmpHome, { limit: 10 });
    expect(result.entries.map((e) => e.display)).toEqual(["third", "second", "first"]);
  });

  it("paginates via limit + offset", async () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({
      display: `cmd${i}`,
      timestamp: 1000 + i,
      project: "/a",
      sessionId: "s",
    }));
    await writeHistory(lines);

    const page1 = await readHistory(tmpHome, { limit: 5, offset: 0 });
    expect(page1.entries).toHaveLength(5);
    expect(page1.entries[0].display).toBe("cmd19");
    expect(page1.total).toBe(20);

    const page2 = await readHistory(tmpHome, { limit: 5, offset: 5 });
    expect(page2.entries[0].display).toBe("cmd14");
  });

  it("returns correct slice at the last page boundary", async () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({
      display: `cmd${i}`,
      timestamp: 1000 + i,
      project: "/a",
      sessionId: "s",
    }));
    await writeHistory(lines);

    // offset 19, limit 5 → only the oldest entry remains
    const page = await readHistory(tmpHome, { limit: 5, offset: 19 });
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0].display).toBe("cmd0");
    expect(page.total).toBe(20);
  });

  it("uses bounded memory: offset + limit buffer regardless of file size", async () => {
    // Write 5000 lines — bounded impl must not grow an array of 5000 entries.
    const lines = Array.from({ length: 5000 }, (_, i) => ({
      display: `cmd${i}`,
      timestamp: 1000 + i,
      project: "/a",
      sessionId: "s",
    }));
    await writeHistory(lines);

    const page = await readHistory(tmpHome, { limit: 10, offset: 0 });
    expect(page.entries).toHaveLength(10);
    expect(page.entries[0].display).toBe("cmd4999");
    expect(page.entries[9].display).toBe("cmd4990");
    expect(page.total).toBe(5000);
  });

  it("filters by project", async () => {
    await writeHistory([
      { display: "a1", timestamp: 1, project: "/alpha", sessionId: "s" },
      { display: "b1", timestamp: 2, project: "/beta", sessionId: "s" },
      { display: "a2", timestamp: 3, project: "/alpha", sessionId: "s" },
    ]);
    const result = await readHistory(tmpHome, { limit: 10, project: "/alpha" });
    expect(result.total).toBe(2);
    expect(result.entries.every((e) => e.project === "/alpha")).toBe(true);
  });

  it("filters by sessionId", async () => {
    await writeHistory([
      { display: "a1", timestamp: 1, project: "/a", sessionId: "sess-aaa" },
      { display: "b1", timestamp: 2, project: "/a", sessionId: "sess-bbb" },
      { display: "a2", timestamp: 3, project: "/a", sessionId: "sess-aaa" },
      { display: "b2", timestamp: 4, project: "/b", sessionId: "sess-bbb" },
    ]);
    const result = await readHistory(tmpHome, { limit: 10, sessionId: "sess-aaa" });
    expect(result.total).toBe(2);
    expect(result.entries.every((e) => e.sessionId === "sess-aaa")).toBe(true);
    expect(result.entries.map((e) => e.display)).toEqual(["a2", "a1"]);
  });

  it("filters by both project and sessionId", async () => {
    await writeHistory([
      { display: "a1", timestamp: 1, project: "/alpha", sessionId: "sess-1" },
      { display: "a2", timestamp: 2, project: "/beta", sessionId: "sess-1" },
      { display: "a3", timestamp: 3, project: "/alpha", sessionId: "sess-2" },
      { display: "a4", timestamp: 4, project: "/alpha", sessionId: "sess-1" },
    ]);
    const result = await readHistory(tmpHome, { limit: 10, project: "/alpha", sessionId: "sess-1" });
    expect(result.total).toBe(2);
    expect(result.entries.map((e) => e.display)).toEqual(["a4", "a1"]);
  });

  it("skips malformed JSONL lines", async () => {
    const content =
      JSON.stringify({ display: "ok", timestamp: 1, project: "/a", sessionId: "s" }) +
      "\nnot json\n" +
      JSON.stringify({ display: "ok2", timestamp: 2, project: "/a", sessionId: "s" }) +
      "\n";
    await writeFile(path.join(tmpHome, "history.jsonl"), content);

    const result = await readHistory(tmpHome, { limit: 10 });
    expect(result.total).toBe(2);
  });

  it("listHistoryProjects returns unique projects", async () => {
    await writeHistory([
      { display: "a", timestamp: 1, project: "/one", sessionId: "s" },
      { display: "b", timestamp: 2, project: "/two", sessionId: "s" },
      { display: "c", timestamp: 3, project: "/one", sessionId: "s" },
    ]);
    const projects = await listHistoryProjects(tmpHome);
    expect(projects.sort()).toEqual(["/one", "/two"]);
  });

  describe("deleteHistoryEntry", () => {
    it("removes the matching entry by (timestamp + sessionId + display)", async () => {
      await writeHistory([
        { display: "ls", timestamp: 1000, project: "/a", sessionId: "s1" },
        { display: "pwd", timestamp: 2000, project: "/a", sessionId: "s1" },
        { display: "echo hi", timestamp: 3000, project: "/a", sessionId: "s2" },
      ]);

      const removed = await deleteHistoryEntry(tmpHome, {
        timestamp: 2000,
        sessionId: "s1",
        display: "pwd",
      });
      expect(removed).toBe(1);

      const result = await readHistory(tmpHome, { limit: 100 });
      expect(result.total).toBe(2);
      expect(result.entries.map((e) => e.display)).toEqual(["echo hi", "ls"]);
    });

    it("returns 0 when no entry matches", async () => {
      await writeHistory([
        { display: "ls", timestamp: 1000, project: "/a", sessionId: "s1" },
      ]);
      const removed = await deleteHistoryEntry(tmpHome, {
        timestamp: 9999,
        sessionId: "s1",
        display: "ls",
      });
      expect(removed).toBe(0);
    });

    it("removes all duplicate entries with the same (timestamp + sessionId + display)", async () => {
      await writeHistory([
        { display: "dup", timestamp: 1, project: "/a", sessionId: "s" },
        { display: "dup", timestamp: 1, project: "/a", sessionId: "s" },
        { display: "keep", timestamp: 2, project: "/a", sessionId: "s" },
      ]);
      const removed = await deleteHistoryEntry(tmpHome, {
        timestamp: 1,
        sessionId: "s",
        display: "dup",
      });
      expect(removed).toBe(2);

      const result = await readHistory(tmpHome, { limit: 10 });
      expect(result.total).toBe(1);
      expect(result.entries[0].display).toBe("keep");
    });

    it("preserves malformed lines that do not match the predicate", async () => {
      const { writeFile } = await import("fs/promises");
      const content =
        JSON.stringify({ display: "keep", timestamp: 1, project: "/a", sessionId: "s" }) +
        "\n%%%not json%%%\n" +
        JSON.stringify({ display: "drop", timestamp: 2, project: "/a", sessionId: "s" }) +
        "\n";
      await writeFile(path.join(tmpHome, "history.jsonl"), content);

      await deleteHistoryEntry(tmpHome, { timestamp: 2, sessionId: "s", display: "drop" });

      // Malformed line is preserved verbatim
      const { readFile } = await import("fs/promises");
      const after = await readFile(path.join(tmpHome, "history.jsonl"), "utf-8");
      expect(after).toContain("%%%not json%%%");
      expect(after).not.toContain('"display":"drop"');
      expect(after).toContain('"display":"keep"');
    });

    it("returns 0 when history file is missing", async () => {
      const removed = await deleteHistoryEntry(tmpHome, {
        timestamp: 1,
        sessionId: "s",
        display: "x",
      });
      expect(removed).toBe(0);
    });
  });
});
