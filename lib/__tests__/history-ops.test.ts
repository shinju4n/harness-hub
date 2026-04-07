import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readHistory, listHistoryProjects } from "../history-ops";
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
});
