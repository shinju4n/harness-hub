import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeItem, scanItemTree } from "../versioned-write";
import { readState, listSnapshots, getObject } from "../version-store";
import { writeFile, mkdir, rm, readFile } from "fs/promises";
import path from "path";
import os from "os";

describe("scanItemTree", () => {
  let tmpDir: string;
  let homePath: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `scan-${Date.now()}`);
    homePath = path.join(tmpDir, "home");
    await mkdir(path.join(homePath, "skills", "my-skill"), { recursive: true });
    await mkdir(path.join(homePath, "agents"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("scans a skill folder", async () => {
    await writeFile(path.join(homePath, "skills", "my-skill", "SKILL.md"), "# Skill");
    const tree = await scanItemTree(homePath, "skill", "my-skill");
    expect(tree["SKILL.md"]).toBeDefined();
    expect(tree["SKILL.md"].content).toBe("# Skill");
  });

  it("scans an agent file", async () => {
    await writeFile(path.join(homePath, "agents", "bot.md"), "# Bot");
    const tree = await scanItemTree(homePath, "agent", "bot");
    expect(tree["bot.md"]).toBeDefined();
    expect(tree["bot.md"].content).toBe("# Bot");
  });

  it("skips .DS_Store and swp files", async () => {
    await writeFile(path.join(homePath, "skills", "my-skill", "SKILL.md"), "ok");
    await writeFile(path.join(homePath, "skills", "my-skill", ".DS_Store"), "junk");
    await writeFile(path.join(homePath, "skills", "my-skill", "temp.swp"), "junk");
    const tree = await scanItemTree(homePath, "skill", "my-skill");
    expect(Object.keys(tree)).toEqual(["SKILL.md"]);
  });
});

describe("writeItem", () => {
  let tmpDir: string;
  let homePath: string;
  let versionBase: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `vw-${Date.now()}`);
    homePath = path.join(tmpDir, "home");
    versionBase = path.join(tmpDir, "versions");
    await mkdir(path.join(homePath, "skills", "my-skill"), { recursive: true });
    await mkdir(path.join(homePath, "agents"), { recursive: true });
    await mkdir(versionBase, { recursive: true });
    await writeFile(path.join(homePath, "skills", "my-skill", "SKILL.md"), "# Original");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes content and creates a snapshot", async () => {
    await writeItem({
      versionBase, homePath, profileId: "test",
      kind: "skill", name: "my-skill", fileName: "SKILL.md",
      content: "# Updated", source: "harness-hub",
    });

    const disk = await readFile(path.join(homePath, "skills", "my-skill", "SKILL.md"), "utf-8");
    expect(disk).toBe("# Updated");

    const snaps = await listSnapshots(versionBase, "skill", "my-skill");
    expect(snaps.length).toBeGreaterThanOrEqual(1);
  });

  it("detects external drift and creates external snapshot first", async () => {
    // Initial write to populate state
    await writeItem({
      versionBase, homePath, profileId: "test",
      kind: "skill", name: "my-skill", fileName: "SKILL.md",
      content: "# V1", source: "harness-hub",
    });

    // Simulate external edit
    await writeFile(path.join(homePath, "skills", "my-skill", "SKILL.md"), "# External");

    // Another harness-hub write
    await writeItem({
      versionBase, homePath, profileId: "test",
      kind: "skill", name: "my-skill", fileName: "SKILL.md",
      content: "# V2", source: "harness-hub",
    });

    const snaps = await listSnapshots(versionBase, "skill", "my-skill");
    const sources = snaps.map((s) => s.source);
    expect(sources).toContain("external");
    expect(sources.filter((s) => s === "harness-hub").length).toBeGreaterThanOrEqual(2);
  });

  it("updates state.json after write", async () => {
    await writeItem({
      versionBase, homePath, profileId: "test",
      kind: "skill", name: "my-skill", fileName: "SKILL.md",
      content: "# State test", source: "harness-hub",
    });

    const state = await readState(versionBase);
    expect(state).not.toBeNull();
    expect(state!.skills["my-skill"]).toBeDefined();
    expect(state!.skills["my-skill"].currentSource).toBe("harness-hub");
  });

  it("serializes concurrent writes via mutex", async () => {
    // Launch two writes in parallel — they should not corrupt state
    await Promise.all([
      writeItem({ versionBase, homePath, profileId: "test", kind: "skill", name: "my-skill", fileName: "SKILL.md", content: "# A", source: "harness-hub" }),
      writeItem({ versionBase, homePath, profileId: "test", kind: "skill", name: "my-skill", fileName: "SKILL.md", content: "# B", source: "harness-hub" }),
    ]);

    const state = await readState(versionBase);
    expect(state).not.toBeNull();
    // Both writes should have completed without error
    const disk = await readFile(path.join(homePath, "skills", "my-skill", "SKILL.md"), "utf-8");
    expect(["# A", "# B"]).toContain(disk);
  });
});
