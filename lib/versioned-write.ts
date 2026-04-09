import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import {
  hashContent,
  putObject,
  createSnapshot,
  readState,
  writeState,
  writeWithFsync,
  ProfileState,
  ItemState,
} from "./version-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_EXTENSIONS = new Set([
  ".md", ".json", ".txt", ".py", ".sh", ".yaml", ".yml", ".toml",
]);

const SKIP_FILES = new Set([".DS_Store"]);
const SKIP_DIRS = new Set(["node_modules", ".git"]);

// ---------------------------------------------------------------------------
// Per-item mutex
// ---------------------------------------------------------------------------

const mutexMap = new Map<string, Promise<void>>();

function acquireMutex(key: string): { release: () => void; wait: Promise<void> } {
  const existing = mutexMap.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const wait = existing.then(() => {});
  mutexMap.set(
    key,
    existing.then(() => next)
  );
  return { release, wait };
}

// ---------------------------------------------------------------------------
// scanItemTree
// ---------------------------------------------------------------------------

export interface ScannedFile {
  content: string;
  mtimeMs: number;
  size: number;
}

function shouldSkipFile(name: string): boolean {
  if (SKIP_FILES.has(name)) return true;
  if (name.startsWith(".")) return true;
  if (name.endsWith(".swp")) return true;
  if (name.endsWith("~")) return true;
  if (name.startsWith("#") && name.endsWith("#")) return true;
  const ext = path.extname(name);
  if (!ALLOWED_EXTENSIONS.has(ext)) return true;
  return false;
}

async function walkDir(
  dir: string,
  relativePrefix: string,
  result: Record<string, ScannedFile>
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;

    const fullPath = path.join(dir, entry);
    const relativePath = relativePrefix ? `${relativePrefix}/${entry}` : entry;

    let info: import("fs").Stats;
    try {
      info = await stat(fullPath);
    } catch {
      continue;
    }

    if (info.isDirectory()) {
      await walkDir(fullPath, relativePath, result);
    } else if (info.isFile()) {
      if (shouldSkipFile(entry)) continue;
      try {
        const content = await readFile(fullPath, "utf-8");
        result[relativePath] = {
          content,
          mtimeMs: info.mtimeMs,
          size: info.size,
        };
      } catch {
        // skip unreadable files
      }
    }
  }
}

export async function scanItemTree(
  homePath: string,
  kind: "skill" | "agent",
  name: string
): Promise<Record<string, ScannedFile>> {
  const result: Record<string, ScannedFile> = {};

  if (kind === "agent") {
    const filePath = path.join(homePath, "agents", `${name}.md`);
    try {
      const info = await stat(filePath);
      const content = await readFile(filePath, "utf-8");
      result[`${name}.md`] = { content, mtimeMs: info.mtimeMs, size: info.size };
    } catch {
      // file doesn't exist yet
    }
  } else {
    const skillDir = path.join(homePath, "skills", name);
    await walkDir(skillDir, "", result);
  }

  return result;
}

// ---------------------------------------------------------------------------
// writeItem
// ---------------------------------------------------------------------------

export interface WriteItemInput {
  versionBase: string;
  homePath: string;
  profileId: string;
  kind: "skill" | "agent";
  name: string;
  fileName: string;
  content: string;
  source: "harness-hub";
}

function itemFilePath(homePath: string, kind: "skill" | "agent", name: string, fileName: string): string {
  if (kind === "agent") {
    return path.join(homePath, "agents", fileName);
  }
  return path.join(homePath, "skills", name, fileName);
}

function defaultItemState(snapshotId: string | null, source: "harness-hub"): ItemState {
  return {
    currentSource: source,
    currentSourceSnapshotId: snapshotId,
    latestSnapshotId: snapshotId,
    deletedAt: null,
    trashId: null,
    pinnedSnapshotIds: [],
  };
}

function defaultProfileState(profileId: string, homePath: string): ProfileState {
  return {
    version: 1,
    profileId,
    homePath,
    files: {},
    skills: {},
    agents: {},
  };
}

async function buildTreeHashes(
  versionBase: string,
  scanned: Record<string, ScannedFile>
): Promise<Record<string, string>> {
  const tree: Record<string, string> = {};
  for (const [relPath, { content }] of Object.entries(scanned)) {
    const hash = await putObject(versionBase, content);
    tree[relPath] = hash;
  }
  return tree;
}

export async function writeItem(input: WriteItemInput): Promise<void> {
  const { versionBase, homePath, profileId, kind, name, fileName, content, source } = input;
  const mutexKey = `${profileId}:${kind}:${name}`;

  const { release, wait } = acquireMutex(mutexKey);
  await wait;

  try {
    // 1. Read current state
    let state = await readState(versionBase);
    if (!state) {
      state = defaultProfileState(profileId, homePath);
    }

    const itemCollection = kind === "skill" ? state.skills : state.agents;
    const existingItem = itemCollection[name];

    // 2. Scan current on-disk state
    const diskTree = await scanItemTree(homePath, kind, name);

    // 3. Check for external drift if we have a previous state
    if (existingItem && Object.keys(diskTree).length > 0) {
      const stateFiles = state.files;
      let drifted = false;

      for (const [relPath, { content: diskContent }] of Object.entries(diskTree)) {
        const diskHash = hashContent(diskContent);
        const trackedFile = stateFiles[`${kind}/${name}/${relPath}`];
        if (trackedFile && trackedFile.hash !== diskHash) {
          drifted = true;
          break;
        }
      }

      if (drifted) {
        // Store external snapshot BEFORE writing
        const externalTreeHashes = await buildTreeHashes(versionBase, diskTree);
        await createSnapshot(versionBase, {
          kind,
          itemName: name,
          source: "external",
          tree: externalTreeHashes,
        });
      }
    }

    // 4. Write new content using tmp+fsync+rename
    const targetPath = itemFilePath(homePath, kind, name, fileName);
    await writeWithFsync(targetPath, content);

    // 5. Scan again after write to get accurate post-write state
    const postWriteTree = await scanItemTree(homePath, kind, name);

    // 6. Create post-write snapshot
    const postWriteTreeHashes = await buildTreeHashes(versionBase, postWriteTree);
    const snapshot = await createSnapshot(versionBase, {
      kind,
      itemName: name,
      source,
      tree: postWriteTreeHashes,
    });

    // 7. Update state.json — refresh from disk first to get latest (concurrent safe)
    const freshState = await readState(versionBase) ?? defaultProfileState(profileId, homePath);
    const freshCollection = kind === "skill" ? freshState.skills : freshState.agents;

    const nowMs = Date.now();

    // Update file tracking in state
    for (const [relPath, { content: fileContent, mtimeMs, size }] of Object.entries(postWriteTree)) {
      const fileKey = `${kind}/${name}/${relPath}`;
      freshState.files[fileKey] = {
        hash: hashContent(fileContent),
        size,
        mtimeMs,
        lastSeenAt: nowMs,
        source: "harness-hub",
      };
    }

    // Update item state
    const existingFreshItem = freshCollection[name];
    freshCollection[name] = {
      currentSource: source,
      currentSourceSnapshotId: snapshot.id,
      latestSnapshotId: snapshot.id,
      deletedAt: existingFreshItem?.deletedAt ?? null,
      trashId: existingFreshItem?.trashId ?? null,
      pinnedSnapshotIds: existingFreshItem?.pinnedSnapshotIds ?? [],
    };

    if (kind === "skill") {
      freshState.skills = freshCollection;
    } else {
      freshState.agents = freshCollection;
    }

    await writeState(versionBase, freshState);
  } finally {
    release();
  }
}
