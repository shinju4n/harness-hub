import { createHash, randomBytes } from "crypto";
import { readFile, rename, mkdir, stat, open, readdir } from "fs/promises";
import path from "path";

// --- Types ---

export interface Snapshot {
  id: string;
  kind: "skill" | "agent";
  itemName: string;
  createdAt: number;
  source: "harness-hub" | "claude-hook" | "external" | "bootstrap" | "restore";
  label?: string;
  sourceSnapshotId?: string;
  tree: Record<string, string>; // relativePath → "sha256:..."
}

export interface FileState {
  hash: string;
  size: number;
  mtimeMs: number;
  lastSeenAt: number;
  source: "harness-hub" | "claude-hook" | "external";
}

export interface ItemState {
  currentSource: "harness-hub" | "claude-hook" | "external" | "bootstrap";
  currentSourceSnapshotId: string | null;
  latestSnapshotId: string | null;
  deletedAt: number | null;
  trashId: string | null;
  pinnedSnapshotIds: string[];
}

export interface ProfileState {
  version: 1;
  profileId: string;
  homePath: string;
  files: Record<string, FileState>;
  skills: Record<string, ItemState>;
  agents: Record<string, ItemState>;
}

// --- writeWithFsync: safe write that file-ops.ts lacks ---
export async function writeWithFsync(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmpPath = filePath + `.tmp.${Date.now()}`;
  const fh = await open(tmpPath, "w");
  try {
    await fh.writeFile(content, "utf-8");
    await fh.sync();
  } finally {
    await fh.close();
  }
  await rename(tmpPath, filePath);
}

export function hashContent(content: string): string {
  const digest = createHash("sha256").update(content, "utf-8").digest("hex");
  return `sha256:${digest}`;
}

function objectPath(baseDir: string, hash: string): string {
  const hex = hash.replace("sha256:", "");
  return path.join(baseDir, "objects", hex.slice(0, 2), `${hex.slice(2)}.bin`);
}

export async function putObject(baseDir: string, content: string): Promise<string> {
  const hash = hashContent(content);
  if (await hasObject(baseDir, hash)) return hash;
  await writeWithFsync(objectPath(baseDir, hash), content);
  return hash;
}

export async function getObject(baseDir: string, hash: string): Promise<string> {
  return readFile(objectPath(baseDir, hash), "utf-8");
}

export async function hasObject(baseDir: string, hash: string): Promise<boolean> {
  try {
    await stat(objectPath(baseDir, hash));
    return true;
  } catch {
    return false;
  }
}

// --- Snapshot helpers ---

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(5).toString("hex").slice(0, 8);
  return `${ts}${rand}`;
}

function snapshotDir(baseDir: string, kind: string, name: string): string {
  return path.join(baseDir, "snapshots", kind, name);
}

function snapshotFilePath(baseDir: string, kind: string, name: string, id: string): string {
  return path.join(snapshotDir(baseDir, kind, name), `${id}.json`);
}

function treeHash(tree: Record<string, string>): string {
  const sorted = Object.keys(tree).sort();
  const content = sorted.map((k) => `${k}:${tree[k]}\n`).join("");
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

export interface CreateSnapshotInput {
  kind: "skill" | "agent";
  itemName: string;
  source: "harness-hub" | "claude-hook" | "external" | "bootstrap" | "restore";
  tree: Record<string, string>;
  label?: string;
  sourceSnapshotId?: string;
}

export async function createSnapshot(baseDir: string, input: CreateSnapshotInput): Promise<Snapshot> {
  // Check for dedup: compare latest snapshot's tree hash
  const existing = await listSnapshots(baseDir, input.kind, input.itemName);
  if (existing.length > 0) {
    const latest = existing[existing.length - 1];
    if (treeHash(latest.tree) === treeHash(input.tree)) {
      return latest;
    }
  }

  const id = generateId();
  const snap: Snapshot = {
    id,
    kind: input.kind,
    itemName: input.itemName,
    createdAt: Date.now(),
    source: input.source,
    tree: input.tree,
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.sourceSnapshotId !== undefined ? { sourceSnapshotId: input.sourceSnapshotId } : {}),
  };

  const filePath = snapshotFilePath(baseDir, input.kind, input.itemName, id);
  await writeWithFsync(filePath, JSON.stringify(snap, null, 2));
  return snap;
}

export async function listSnapshots(baseDir: string, kind: string, name: string): Promise<Snapshot[]> {
  const dir = snapshotDir(baseDir, kind, name);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const snapshots: Snapshot[] = [];
  for (const entry of entries) {
    if (entry.startsWith("_") || !entry.endsWith(".json")) continue;
    const id = entry.slice(0, -5);
    const filePath = path.join(dir, entry);
    try {
      const content = await readFile(filePath, "utf-8");
      snapshots.push(JSON.parse(content) as Snapshot);
    } catch {
      // skip unreadable files
    }
  }

  // Sort by id ascending (chronological since id is time-prefixed)
  snapshots.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return snapshots;
}

export async function getSnapshot(
  baseDir: string,
  kind: string,
  name: string,
  id: string
): Promise<Snapshot | null> {
  const filePath = snapshotFilePath(baseDir, kind, name, id);
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Snapshot;
  } catch {
    return null;
  }
}

// --- State persistence ---

export async function readState(baseDir: string): Promise<ProfileState | null> {
  const filePath = path.join(baseDir, "state.json");
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as ProfileState;
  } catch {
    return null;
  }
}

export async function writeState(baseDir: string, state: ProfileState): Promise<void> {
  const filePath = path.join(baseDir, "state.json");
  await writeWithFsync(filePath, JSON.stringify(state, null, 2));
}

// --- Integrity scan ---

export async function runIntegrityScan(baseDir: string): Promise<{ corruptedSnapshots: string[] }> {
  const state = await readState(baseDir);
  if (!state) return { corruptedSnapshots: [] };

  const corruptedSnapshots: string[] = [];

  async function checkItemSnapshots(kind: "skill" | "agent", name: string): Promise<void> {
    const snapshots = await listSnapshots(baseDir, kind, name);
    for (const snap of snapshots) {
      let corrupted = false;
      for (const hash of Object.values(snap.tree)) {
        if (!(await hasObject(baseDir, hash))) {
          corrupted = true;
          break;
        }
      }
      if (corrupted) {
        corruptedSnapshots.push(`${kind}/${name}/${snap.id}`);
      }
    }
  }

  const checks: Promise<void>[] = [];
  for (const name of Object.keys(state.skills)) {
    checks.push(checkItemSnapshots("skill", name));
  }
  for (const name of Object.keys(state.agents)) {
    checks.push(checkItemSnapshots("agent", name));
  }

  await Promise.all(checks);
  return { corruptedSnapshots };
}
