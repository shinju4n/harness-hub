import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runRescan } from "../external-rescan";
import { writeState, readState, listSnapshots, type ProfileState } from "../version-store";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";

describe("external-rescan", () => {
  let tmpDir: string;
  let homePath: string;
  let versionBase: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `rescan-${Date.now()}`);
    homePath = path.join(tmpDir, "home");
    versionBase = path.join(tmpDir, "versions");
    await mkdir(path.join(homePath, "skills", "foo"), { recursive: true });
    await mkdir(path.join(homePath, "agents"), { recursive: true });
    await mkdir(versionBase, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates bootstrap snapshots for new items", async () => {
    await writeFile(path.join(homePath, "skills", "foo", "SKILL.md"), "# Foo");
    await writeFile(path.join(homePath, "agents", "bar.md"), "# Bar");
    const report = await runRescan({ versionBase, homePath, profileId: "test" });
    expect(report.newItems).toContain("skill/foo");
    expect(report.newItems).toContain("agent/bar");
    expect(await listSnapshots(versionBase, "skill", "foo")).toHaveLength(1);
    expect(await listSnapshots(versionBase, "agent", "bar")).toHaveLength(1);
  });

  it("detects external changes to a tracked file", async () => {
    await writeFile(path.join(homePath, "skills", "foo", "SKILL.md"), "# V1");
    await runRescan({ versionBase, homePath, profileId: "test" });
    await writeFile(path.join(homePath, "skills", "foo", "SKILL.md"), "# V2");
    const report = await runRescan({ versionBase, homePath, profileId: "test" });
    expect(report.driftedItems).toContain("skill/foo");
    expect(await listSnapshots(versionBase, "skill", "foo")).toHaveLength(2);
  });

  it("skips items with no changes", async () => {
    await writeFile(path.join(homePath, "skills", "foo", "SKILL.md"), "# Same");
    await runRescan({ versionBase, homePath, profileId: "test" });
    const report = await runRescan({ versionBase, homePath, profileId: "test" });
    expect(report.driftedItems).toHaveLength(0);
    expect(report.newItems).toHaveLength(0);
  });

  it("soft-deletes items that disappeared from disk", async () => {
    await writeFile(path.join(homePath, "skills", "foo", "SKILL.md"), "# Gone");
    await runRescan({ versionBase, homePath, profileId: "test" });
    await rm(path.join(homePath, "skills", "foo"), { recursive: true });
    const report = await runRescan({ versionBase, homePath, profileId: "test" });
    expect(report.deletedItems).toContain("skill/foo");
    const state = await readState(versionBase);
    expect(state?.skills.foo.deletedAt).toBeTruthy();
  });

  it("scoped rescan only processes the specified item", async () => {
    await writeFile(path.join(homePath, "skills", "foo", "SKILL.md"), "# Foo");
    await writeFile(path.join(homePath, "agents", "bar.md"), "# Bar");
    const report = await runRescan({
      versionBase, homePath, profileId: "test",
      scopedItem: { kind: "skill", name: "foo" },
    });
    expect(report.newItems).toContain("skill/foo");
    expect(report.newItems).not.toContain("agent/bar");
  });

  it("archives state when homePath changes", async () => {
    await writeFile(path.join(homePath, "skills", "foo", "SKILL.md"), "# V1");
    await runRescan({ versionBase, homePath, profileId: "test" });

    // Change homePath
    const newHome = path.join(tmpDir, "home2");
    await mkdir(path.join(newHome, "skills", "baz"), { recursive: true });
    await writeFile(path.join(newHome, "skills", "baz", "SKILL.md"), "# Baz");
    await runRescan({ versionBase, homePath: newHome, profileId: "test" });

    const state = await readState(versionBase);
    expect(state?.homePath).toBe(newHome);
    expect(state?.skills.baz).toBeDefined();
    // Old skill "foo" should not be in the new state
    expect(state?.skills.foo).toBeUndefined();
  });
});
