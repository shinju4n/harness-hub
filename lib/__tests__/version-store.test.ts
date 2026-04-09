import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  putObject,
  getObject,
  hasObject,
  hashContent,
  createSnapshot,
  listSnapshots,
  getSnapshot,
  readState,
  writeState,
  runIntegrityScan,
} from "../version-store";
import type { ProfileState } from "../version-store";
import { mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";

describe("object store", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = path.join(os.tmpdir(), `vs-test-${Date.now()}`);
    await mkdir(baseDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it("hashContent returns sha256 prefixed hex", () => {
    const hash = hashContent("hello");
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("stores and retrieves content by hash", async () => {
    const content = "hello world";
    const hash = await putObject(baseDir, content);
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    const retrieved = await getObject(baseDir, hash);
    expect(retrieved).toBe(content);
  });

  it("deduplicates identical content", async () => {
    const h1 = await putObject(baseDir, "same");
    const h2 = await putObject(baseDir, "same");
    expect(h1).toBe(h2);
  });

  it("hasObject returns true for existing, false for missing", async () => {
    const hash = await putObject(baseDir, "exists");
    expect(await hasObject(baseDir, hash)).toBe(true);
    expect(await hasObject(baseDir, "sha256:0000000000000000000000000000000000000000000000000000000000000000")).toBe(false);
  });

  it("handles different content with different hashes", async () => {
    const h1 = await putObject(baseDir, "content A");
    const h2 = await putObject(baseDir, "content B");
    expect(h1).not.toBe(h2);
    expect(await getObject(baseDir, h1)).toBe("content A");
    expect(await getObject(baseDir, h2)).toBe("content B");
  });
});

describe("snapshots", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = path.join(os.tmpdir(), `vs-snap-${Date.now()}`);
    await mkdir(baseDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it("creates and retrieves a snapshot", async () => {
    const tree = { "SKILL.md": await putObject(baseDir, "# Hello") };
    const snap = await createSnapshot(baseDir, {
      kind: "skill", itemName: "test-skill", source: "harness-hub", tree,
    });
    expect(snap.id).toBeDefined();
    expect(snap.tree).toEqual(tree);
    const retrieved = await getSnapshot(baseDir, "skill", "test-skill", snap.id);
    expect(retrieved?.tree).toEqual(tree);
  });

  it("deduplicates identical tree snapshots", async () => {
    const tree = { "SKILL.md": await putObject(baseDir, "same content") };
    const s1 = await createSnapshot(baseDir, { kind: "skill", itemName: "s", source: "harness-hub", tree });
    const s2 = await createSnapshot(baseDir, { kind: "skill", itemName: "s", source: "harness-hub", tree });
    expect(s1.id).toBe(s2.id);
  });

  it("creates new snapshot when tree changes", async () => {
    const h1 = await putObject(baseDir, "v1");
    const h2 = await putObject(baseDir, "v2");
    const s1 = await createSnapshot(baseDir, { kind: "agent", itemName: "a", source: "harness-hub", tree: { "a.md": h1 } });
    const s2 = await createSnapshot(baseDir, { kind: "agent", itemName: "a", source: "external", tree: { "a.md": h2 } });
    expect(s1.id).not.toBe(s2.id);
    const list = await listSnapshots(baseDir, "agent", "a");
    expect(list).toHaveLength(2);
    expect(list[0].source).toBe("harness-hub");
    expect(list[1].source).toBe("external");
  });
});

describe("state", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = path.join(os.tmpdir(), `vs-state-${Date.now()}`);
    await mkdir(baseDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it("round-trips state.json", async () => {
    const state: ProfileState = {
      version: 1, profileId: "test", homePath: "/tmp/test",
      files: {}, skills: {}, agents: {},
    };
    await writeState(baseDir, state);
    const read = await readState(baseDir);
    expect(read).toEqual(state);
  });

  it("returns null for missing state", async () => {
    expect(await readState(baseDir)).toBeNull();
  });
});

describe("integrity scan", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = path.join(os.tmpdir(), `vs-int-${Date.now()}`);
    await mkdir(baseDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it("reports no corruption when all objects exist", async () => {
    const hash = await putObject(baseDir, "hello");
    await createSnapshot(baseDir, { kind: "skill", itemName: "ok", source: "bootstrap", tree: { "a.md": hash } });
    await writeState(baseDir, {
      version: 1, profileId: "t", homePath: "/t", files: {},
      skills: { ok: { currentSource: "bootstrap", currentSourceSnapshotId: null, latestSnapshotId: null, deletedAt: null, trashId: null, pinnedSnapshotIds: [] } },
      agents: {},
    });
    const result = await runIntegrityScan(baseDir);
    expect(result.corruptedSnapshots).toHaveLength(0);
  });

  it("detects corrupted snapshots with missing objects", async () => {
    const goodHash = await putObject(baseDir, "exists");
    const badHash = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    await createSnapshot(baseDir, { kind: "skill", itemName: "good", source: "bootstrap", tree: { "a.md": goodHash } });
    await createSnapshot(baseDir, { kind: "skill", itemName: "bad", source: "bootstrap", tree: { "b.md": badHash } });
    await writeState(baseDir, {
      version: 1, profileId: "t", homePath: "/t", files: {},
      skills: {
        good: { currentSource: "bootstrap", currentSourceSnapshotId: null, latestSnapshotId: null, deletedAt: null, trashId: null, pinnedSnapshotIds: [] },
        bad: { currentSource: "bootstrap", currentSourceSnapshotId: null, latestSnapshotId: null, deletedAt: null, trashId: null, pinnedSnapshotIds: [] },
      },
      agents: {},
    });
    const result = await runIntegrityScan(baseDir);
    expect(result.corruptedSnapshots.length).toBeGreaterThan(0);
  });
});
