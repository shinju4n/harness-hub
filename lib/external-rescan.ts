import { readdir, rename } from "fs/promises";
import path from "path";
import {
  hashContent,
  putObject,
  createSnapshot,
  readState,
  writeState,
  ProfileState,
  ItemState,
} from "./version-store";
import { scanItemTree } from "./versioned-write";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RescanInput {
  versionBase: string;
  homePath: string;
  profileId: string;
  scopedItem?: { kind: "skill" | "agent"; name: string };
}

export interface RescanReport {
  newItems: string[];
  driftedItems: string[];
  deletedItems: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function defaultItemState(): ItemState {
  return {
    currentSource: "external",
    currentSourceSnapshotId: null,
    latestSnapshotId: null,
    deletedAt: null,
    trashId: null,
    pinnedSnapshotIds: [],
  };
}

async function buildTreeHashes(
  versionBase: string,
  scanned: Record<string, { content: string; mtimeMs: number; size: number }>
): Promise<Record<string, string>> {
  const tree: Record<string, string> = {};
  for (const [relPath, { content }] of Object.entries(scanned)) {
    const hash = await putObject(versionBase, content);
    tree[relPath] = hash;
  }
  return tree;
}

async function discoverSkills(homePath: string): Promise<string[]> {
  const skillsDir = path.join(homePath, "skills");
  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

async function discoverAgents(homePath: string): Promise<string[]> {
  const agentsDir = path.join(homePath, "agents");
  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md") && !e.name.startsWith("."))
      .map((e) => e.name.slice(0, -3)); // strip .md
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// processItem: scan one item and create snapshots as needed
// ---------------------------------------------------------------------------

async function processItem(
  versionBase: string,
  homePath: string,
  state: ProfileState,
  kind: "skill" | "agent",
  name: string,
  report: RescanReport
): Promise<void> {
  const collection = kind === "skill" ? state.skills : state.agents;
  const existingItem = collection[name];
  const itemKey = `${kind}/${name}`;

  // Scan disk
  const diskTree = await scanItemTree(homePath, kind, name);

  if (Object.keys(diskTree).length === 0) {
    // Nothing on disk — skip (deletion is handled separately in full rescan)
    return;
  }

  // Build current tree hashes (store objects)
  const treeHashes = await buildTreeHashes(versionBase, diskTree);

  if (!existingItem || existingItem.latestSnapshotId === null) {
    // New item — bootstrap snapshot
    const snapshot = await createSnapshot(versionBase, {
      kind,
      itemName: name,
      source: "bootstrap",
      tree: treeHashes,
    });

    const nowMs = Date.now();

    // Update file tracking
    for (const [relPath, { content, mtimeMs, size }] of Object.entries(diskTree)) {
      const fileKey = `${kind}/${name}/${relPath}`;
      state.files[fileKey] = {
        hash: hashContent(content),
        size,
        mtimeMs,
        lastSeenAt: nowMs,
        source: "external",
      };
    }

    collection[name] = {
      ...(existingItem ?? defaultItemState()),
      currentSource: "bootstrap",
      currentSourceSnapshotId: snapshot.id,
      latestSnapshotId: snapshot.id,
      deletedAt: null,
      trashId: null,
    };

    report.newItems.push(itemKey);
    return;
  }

  // Existing item — check for drift against tracked file hashes
  let drifted = false;
  for (const [relPath, { content: diskContent }] of Object.entries(diskTree)) {
    const diskHash = hashContent(diskContent);
    const fileKey = `${kind}/${name}/${relPath}`;
    const trackedFile = state.files[fileKey];
    if (!trackedFile || trackedFile.hash !== diskHash) {
      drifted = true;
      break;
    }
  }

  if (!drifted) {
    // No change — skip
    return;
  }

  // Drifted — create external snapshot
  const snapshot = await createSnapshot(versionBase, {
    kind,
    itemName: name,
    source: "external",
    tree: treeHashes,
  });

  const nowMs = Date.now();

  // Update file tracking
  for (const [relPath, { content, mtimeMs, size }] of Object.entries(diskTree)) {
    const fileKey = `${kind}/${name}/${relPath}`;
    state.files[fileKey] = {
      hash: hashContent(content),
      size,
      mtimeMs,
      lastSeenAt: nowMs,
      source: "external",
    };
  }

  collection[name] = {
    ...existingItem,
    currentSource: "external",
    currentSourceSnapshotId: snapshot.id,
    latestSnapshotId: snapshot.id,
    deletedAt: null,
    trashId: null,
  };

  report.driftedItems.push(itemKey);
}

// ---------------------------------------------------------------------------
// runRescan
// ---------------------------------------------------------------------------

export async function runRescan(input: RescanInput): Promise<RescanReport> {
  const { versionBase, homePath, profileId, scopedItem } = input;
  const report: RescanReport = {
    newItems: [],
    driftedItems: [],
    deletedItems: [],
  };

  // 1. Read state
  let state = await readState(versionBase);

  // 2. homePath drift check
  if (state && state.homePath !== homePath) {
    const stateFilePath = path.join(versionBase, "state.json");
    const archivedPath = path.join(versionBase, `state.archived-${Date.now()}.json`);
    await rename(stateFilePath, archivedPath);
    state = null;
  }

  if (!state) {
    state = defaultProfileState(profileId, homePath);
  }

  // 3. Discover items on disk
  if (scopedItem) {
    // Scoped: only process the specified item
    await processItem(versionBase, homePath, state, scopedItem.kind, scopedItem.name, report);
  } else {
    // Full rescan: discover all items
    const [skillNames, agentNames] = await Promise.all([
      discoverSkills(homePath),
      discoverAgents(homePath),
    ]);

    // Process all discovered items
    for (const name of skillNames) {
      await processItem(versionBase, homePath, state, "skill", name, report);
    }
    for (const name of agentNames) {
      await processItem(versionBase, homePath, state, "agent", name, report);
    }

    // 6. Deletion detection: items in state but not on disk
    const diskSkillSet = new Set(skillNames);
    const diskAgentSet = new Set(agentNames);
    const nowMs = Date.now();

    for (const [name, itemState] of Object.entries(state.skills)) {
      if (!diskSkillSet.has(name) && !itemState.deletedAt) {
        state.skills[name] = {
          ...itemState,
          deletedAt: nowMs,
          trashId: `trash-${Date.now()}-${name}`,
        };
        report.deletedItems.push(`skill/${name}`);
      }
    }

    for (const [name, itemState] of Object.entries(state.agents)) {
      if (!diskAgentSet.has(name) && !itemState.deletedAt) {
        state.agents[name] = {
          ...itemState,
          deletedAt: nowMs,
          trashId: `trash-${Date.now()}-${name}`,
        };
        report.deletedItems.push(`agent/${name}`);
      }
    }
  }

  // 7. Persist updated state
  await writeState(versionBase, state);

  return report;
}
