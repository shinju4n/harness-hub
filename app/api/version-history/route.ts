import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { rename, mkdir, rm, unlink } from "fs/promises";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVersionBase(userDataPath: string, profileId: string): string {
  return path.join(userDataPath, "versions", profileId);
}

function getHeaders(request: Request): { userDataPath: string | null; profileId: string | null } {
  return {
    userDataPath: request.headers.get("x-user-data-path"),
    profileId: request.headers.get("x-profile-id"),
  };
}

function missing503() {
  return NextResponse.json(
    { error: "x-user-data-path or x-profile-id header missing" },
    { status: 503 }
  );
}

function isSafe(segment: string): boolean {
  return !segment.includes("..") && !segment.includes("/") && !segment.includes("\\");
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { userDataPath, profileId } = getHeaders(request);
  if (!userDataPath || !profileId) return missing503();

  const versionBase = getVersionBase(userDataPath, profileId);
  const params = request.nextUrl.searchParams;
  const action = params.get("action");
  const kind = params.get("kind") as "skill" | "agent" | null;
  const name = params.get("name");

  // --- list ---
  if (action === "list") {
    if (!kind || !name) {
      return NextResponse.json({ error: "kind and name required" }, { status: 400 });
    }
    if (!isSafe(name)) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const { listSnapshots } = await import("@/lib/version-store");
    const snapshots = await listSnapshots(versionBase, kind, name);
    return NextResponse.json({ snapshots });
  }

  // --- get ---
  if (action === "get") {
    const snapshotId = params.get("id");
    if (!kind || !name || !snapshotId) {
      return NextResponse.json({ error: "kind, name, and id required" }, { status: 400 });
    }
    if (!isSafe(name) || !isSafe(snapshotId)) {
      return NextResponse.json({ error: "Invalid parameter" }, { status: 400 });
    }

    const { getSnapshot, getObject } = await import("@/lib/version-store");
    const snapshot = await getSnapshot(versionBase, kind, name, snapshotId);
    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    // Resolve tree entries to their content strings
    const contents: Record<string, string> = {};
    for (const [relPath, hash] of Object.entries(snapshot.tree)) {
      try {
        contents[relPath] = await getObject(versionBase, hash);
      } catch {
        contents[relPath] = "";
      }
    }

    return NextResponse.json({ snapshot, contents });
  }

  // --- state ---
  if (action === "state") {
    if (!kind || !name) {
      return NextResponse.json({ error: "kind and name required" }, { status: 400 });
    }
    if (!isSafe(name)) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const { readState } = await import("@/lib/version-store");
    const state = await readState(versionBase);
    if (!state) {
      return NextResponse.json({ itemState: null });
    }

    const collection = kind === "skill" ? state.skills : state.agents;
    const itemState = collection[name] ?? null;
    return NextResponse.json({ itemState });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const { userDataPath, profileId } = getHeaders(request);
  if (!userDataPath || !profileId) return missing503();

  const versionBase = getVersionBase(userDataPath, profileId);
  const body = await request.json();
  const { action } = body;

  // --- restore ---
  if (action === "restore") {
    const { kind, name, snapshotId } = body as {
      kind: "skill" | "agent";
      name: string;
      snapshotId: string;
    };

    if (!kind || !name || !snapshotId) {
      return NextResponse.json({ error: "kind, name, snapshotId required" }, { status: 400 });
    }
    if (!isSafe(name) || !isSafe(snapshotId)) {
      return NextResponse.json({ error: "Invalid parameter" }, { status: 400 });
    }

    const claudeHome = getClaudeHomeFromRequest(request);

    const { getSnapshot, putObject, createSnapshot, getObject } = await import(
      "@/lib/version-store"
    );
    const { scanItemTree } = await import("@/lib/versioned-write");

    // 1. Get target snapshot
    const targetSnapshot = await getSnapshot(versionBase, kind, name, snapshotId);
    if (!targetSnapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    // 2. Scan current disk state → create "pre-restore" snapshot
    const currentTree = await scanItemTree(claudeHome, kind, name);
    const preRestoreTree: Record<string, string> = {};
    for (const [relPath, { content }] of Object.entries(currentTree)) {
      preRestoreTree[relPath] = await putObject(versionBase, content);
    }

    await createSnapshot(versionBase, {
      kind,
      itemName: name,
      source: "harness-hub",
      tree: preRestoreTree,
      label: "Pre-restore snapshot",
    });

    // 3. Write snapshot files to disk
    const { writeWithFsync } = await import("@/lib/version-store");

    if (kind === "agent") {
      // Agent: single file at agents/{name}.md
      const agentRelPath = `${name}.md`;
      const hash = targetSnapshot.tree[agentRelPath];
      if (hash) {
        const content = await getObject(versionBase, hash);
        const targetPath = path.join(claudeHome, "agents", agentRelPath);
        await writeWithFsync(targetPath, content);
      }
    } else {
      // Skill: write all files in snapshot, remove files not in snapshot
      const skillDir = path.join(claudeHome, "skills", name);

      // Write all files from snapshot
      for (const [relPath, hash] of Object.entries(targetSnapshot.tree)) {
        const content = await getObject(versionBase, hash);
        const targetPath = path.join(skillDir, relPath);
        await writeWithFsync(targetPath, content);
      }

      // Remove files that exist on disk but not in snapshot
      for (const relPath of Object.keys(currentTree)) {
        if (!(relPath in targetSnapshot.tree)) {
          const extraPath = path.join(skillDir, relPath);
          try {
            await unlink(extraPath);
          } catch {
            // ignore if file was already removed
          }
        }
      }
    }

    // 4. Create "restore" snapshot
    const restoreSnapshot = await createSnapshot(versionBase, {
      kind,
      itemName: name,
      source: "restore",
      tree: targetSnapshot.tree,
      label: `Restored from ${snapshotId}`,
      sourceSnapshotId: snapshotId,
    });

    return NextResponse.json({ success: true, snapshotId: restoreSnapshot.id });
  }

  // --- pin ---
  if (action === "pin" || action === "unpin") {
    const { kind, name, snapshotId } = body as {
      kind: "skill" | "agent";
      name: string;
      snapshotId: string;
    };

    if (!kind || !name || !snapshotId) {
      return NextResponse.json({ error: "kind, name, snapshotId required" }, { status: 400 });
    }
    if (!isSafe(name) || !isSafe(snapshotId)) {
      return NextResponse.json({ error: "Invalid parameter" }, { status: 400 });
    }

    const { readState, writeState } = await import("@/lib/version-store");
    const state = await readState(versionBase);
    if (!state) {
      return NextResponse.json({ error: "State not found" }, { status: 404 });
    }

    const collection = kind === "skill" ? state.skills : state.agents;
    const itemState = collection[name];
    if (!itemState) {
      return NextResponse.json({ error: "Item not found in state" }, { status: 404 });
    }

    const pinned = new Set(itemState.pinnedSnapshotIds ?? []);
    if (action === "pin") {
      pinned.add(snapshotId);
    } else {
      pinned.delete(snapshotId);
    }

    itemState.pinnedSnapshotIds = Array.from(pinned);
    collection[name] = itemState;

    if (kind === "skill") {
      state.skills = collection;
    } else {
      state.agents = collection;
    }

    await writeState(versionBase, state);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const { userDataPath, profileId } = getHeaders(request);
  if (!userDataPath || !profileId) return missing503();

  const params = request.nextUrl.searchParams;
  const action = params.get("action");

  if (action === "archiveProfile") {
    const id = params.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    if (!isSafe(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const versionsDir = path.join(userDataPath, "versions");
    const sourcePath = path.join(versionsDir, id);
    const archivedDir = path.join(versionsDir, "_archived");
    const timestamp = Date.now();
    const destPath = path.join(archivedDir, `${timestamp}_${id}`);

    try {
      await mkdir(archivedDir, { recursive: true });
      await rename(sourcePath, destPath);
      return NextResponse.json({ success: true, archivedTo: destPath });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
