# Skill / Agent Version History — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every edit to Skills and Agents — from harness-hub, Claude Code, or any external tool — as browsable, diffable, restorable snapshots, scoped per profile.

**Architecture:** Content-addressable object store + tree snapshots under Electron userData. Detection via Claude Code PostToolUse HTTP hook (real-time for Claude edits) plus launch/focus rescan (catch-all for other tools). Per-item in-process mutex serializes concurrent writes. See `docs/superpowers/specs/2026-04-09-skill-agent-version-history-design.md` for full rationale.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Electron 41, Zustand 5, Vitest, react-diff-viewer-continued, react-resizable-panels (existing).

**Test command:** `pnpm vitest run --config vitest.config.node.mts`

**Pre-implementation checklist (§15 of spec — verify before starting):**
- [ ] Verify Claude Code PostToolUse `type: "http"` hook schema against latest official docs
- [ ] Confirm `react-diff-viewer-continued` supports React 19
- [ ] Confirm `react-resizable-panels` supports nested `Group` rendering (v4.9.0)
- [ ] Ensure `electron-src/main.ts`'s `createWindow()` is the single `BrowserWindow` creation point

**Intentional spec deviations:**
- `lib/user-data-path.ts` (spec §5.3) is **not created**. Instead, the plan uses `globalThis.__harnessHubUserDataPath` set by the IPC handshake in `VersionHistoryProvider` + the `x-user-data-path` header. This is simpler and avoids a helper that would either duplicate `app.getPath('userData')` logic or import Electron.
- `app/api/trash/route.ts` (spec §5.3) is **merged into** `app/api/version-history/route.ts` because trash operations share the same state.json data model. A separate route would duplicate state reading/writing.

---

## Phase 1: Prerequisites

### Task 1: Fix Skills frontmatter round-trip bug

**Files:**
- Modify: `app/api/skills/route.ts:7-38`
- Modify: `app/skills/page.tsx:47-72`

This is an existing bug where editing a skill via harness-hub silently strips frontmatter. Must be fixed before version history ships, or snapshots would encode the data loss.

- [ ] **Step 1: Verify the bug exists**

Open a skill that has frontmatter (e.g. `---\nname: foo\ndescription: bar\n---\n# Content`), edit it in harness-hub, save, then re-read. The frontmatter should be gone. Confirm by reading `app/api/skills/route.ts:36` which returns `content` (body only) not `rawContent`.

- [ ] **Step 2: Update Skills GET to return rawContent**

In `app/api/skills/route.ts`, after `readMarkdownFile(skillPath)`, also read the raw file bytes and include them in the response:

```typescript
// In the GET handler, after readMarkdownFile succeeds (around line 36):
import { readFile } from "fs/promises";

// Replace the existing success return with:
let rawContent = "";
try { rawContent = await readFile(skillPath, "utf-8"); } catch {}
return NextResponse.json({
  content: result.data.content,
  frontmatter: result.data.frontmatter,
  rawContent,
});
```

- [ ] **Step 3: Update Skills page to pass rawContent to MarkdownViewer**

In `app/skills/page.tsx`, the `SelectedSkill` interface and `viewSkill`/`saveSkill` handlers need `rawContent`:

```typescript
// Add rawContent to SelectedSkill interface:
interface SelectedSkill {
  content: string;
  rawContent: string; // <-- add
  name: string;
  source: "plugin" | "custom";
  pluginName?: string;
  marketplace?: string;
}

// In viewSkill(), add rawContent to setSelected:
setSelected({
  content: data.content,
  rawContent: data.rawContent ?? data.content, // <-- add
  name: skill.name,
  source: skill.source,
  pluginName: skill.pluginName,
  marketplace: skill.marketplace,
});

// In saveSkill(), update rawContent after save:
setSelected({ ...selected, content, rawContent: content }); // <-- change

// In JSX where MarkdownViewer is rendered (~line 255 and ~274):
<MarkdownViewer
  content={selected.content}
  rawContent={selected.rawContent}  // <-- add this prop
  fileName={`${selected.name}.md`}
  onSave={selected.source === "custom" ? saveSkill : undefined}
/>
```

`MarkdownViewer` already accepts `rawContent` prop and uses it as the edit source (`components/markdown-viewer.tsx:20`). No viewer changes needed.

- [ ] **Step 4: Manual verification**

Create a test skill with frontmatter, edit content in harness-hub, save, reload. Frontmatter should be preserved.

- [ ] **Step 5: Commit**

```bash
git add app/api/skills/route.ts app/skills/page.tsx
git commit -m "fix: preserve skills frontmatter on edit round-trip"
```

---

### Task 2: Electron IPC — user data path + window focus event

**Files:**
- Modify: `electron-src/main.ts:81-104,175-256`
- Modify: `electron-src/preload.ts`

Add two IPC channels that the version history feature needs: one for userData path retrieval, one for window focus event.

- [ ] **Step 1: Add IPC handler for userData path**

In `electron-src/main.ts`, inside `app.whenReady().then(...)`, after `terminalManager` setup (~line 196), add:

```typescript
ipcMain.handle("version-store:base-path", () => {
  return app.getPath("userData");
});
```

- [ ] **Step 2: Add focus event listener in createWindow()**

In `electron-src/main.ts`, inside `createWindow()` after `mainWindow.on("closed", ...)` (line 101-103):

```typescript
mainWindow.on("focus", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("window:regain-focus");
  }
});
```

- [ ] **Step 3: Expose in preload.ts**

In `electron-src/preload.ts`, add a new `contextBridge.exposeInMainWorld` block after the existing `electronTerminal` one:

```typescript
contextBridge.exposeInMainWorld("electronVersionStore", {
  getBasePath: (): Promise<string> =>
    ipcRenderer.invoke("version-store:base-path"),

  onWindowRegainFocus: (cb: () => void): (() => void) => {
    const handler = () => cb();
    ipcRenderer.on("window:regain-focus", handler);
    return () => ipcRenderer.removeListener("window:regain-focus", handler);
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add electron-src/main.ts electron-src/preload.ts
git commit -m "feat: add Electron IPC for userData path and window focus event"
```

---

### Task 3: Path validator hardening

**Files:**
- Create: `lib/path-validator.ts`
- Create: `lib/__tests__/path-validator.test.ts`

Extract and harden the path segment validation from skills/agents routes (currently inline `isSafePathSegment`). The version store also uses this for snapshot/object paths.

- [ ] **Step 1: Write failing tests**

```typescript
// lib/__tests__/path-validator.test.ts
import { describe, it, expect } from "vitest";
import { isSafeSegment } from "../path-validator";

describe("isSafeSegment", () => {
  it("accepts normal names", () => {
    expect(isSafeSegment("my-skill")).toBe(true);
    expect(isSafeSegment("agent_v2")).toBe(true);
    expect(isSafeSegment("日本語")).toBe(true);
  });

  it("rejects traversal", () => {
    expect(isSafeSegment("..")).toBe(false);
    expect(isSafeSegment("foo/bar")).toBe(false);
    expect(isSafeSegment("foo\\bar")).toBe(false);
  });

  it("rejects empty and dots-only", () => {
    expect(isSafeSegment("")).toBe(false);
    expect(isSafeSegment(".")).toBe(false);
    expect(isSafeSegment("...")).toBe(false);
  });

  it("rejects NUL byte", () => {
    expect(isSafeSegment("foo\x00bar")).toBe(false);
  });

  it("rejects leading/trailing whitespace", () => {
    expect(isSafeSegment(" foo")).toBe(false);
    expect(isSafeSegment("foo ")).toBe(false);
  });

  it("rejects Windows reserved names", () => {
    expect(isSafeSegment("CON")).toBe(false);
    expect(isSafeSegment("con")).toBe(false);
    expect(isSafeSegment("PRN")).toBe(false);
    expect(isSafeSegment("COM1")).toBe(false);
    expect(isSafeSegment("LPT9")).toBe(false);
    expect(isSafeSegment("NUL")).toBe(false);
  });

  it("allows names containing reserved as substring", () => {
    expect(isSafeSegment("CONNECT")).toBe(true);
    expect(isSafeSegment("null-skill")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm vitest run --config vitest.config.node.mts lib/__tests__/path-validator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// lib/path-validator.ts
const WINDOWS_RESERVED = new Set([
  "con", "prn", "aux", "nul",
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

export function isSafeSegment(segment: string): boolean {
  if (!segment || segment !== segment.trim()) return false;
  if (segment.includes("\x00")) return false;
  if (segment.includes("/") || segment.includes("\\") || segment.includes("..")) return false;
  if (/^\.+$/.test(segment)) return false;
  if (WINDOWS_RESERVED.has(segment.toLowerCase())) return false;
  return true;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm vitest run --config vitest.config.node.mts lib/__tests__/path-validator.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/path-validator.ts lib/__tests__/path-validator.test.ts
git commit -m "feat: add hardened path segment validator"
```

---

## Phase 2: Version Store Core

### Task 4: Object store primitives

**Files:**
- Create: `lib/version-store.ts`
- Create: `lib/__tests__/version-store.test.ts`

Build the content-addressable blob store: put, get, has.

- [ ] **Step 1: Write failing tests for object primitives**

```typescript
// lib/__tests__/version-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { putObject, getObject, hasObject } from "../version-store";
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
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `pnpm vitest run --config vitest.config.node.mts lib/__tests__/version-store.test.ts`

- [ ] **Step 3: Implement object store**

```typescript
// lib/version-store.ts
import { createHash } from "crypto";
import { readFile, writeFile, rename, mkdir, stat, open } from "fs/promises";
import path from "path";

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
  const objPath = objectPath(baseDir, hash);
  if (await hasObject(baseDir, hash)) return hash;
  await writeWithFsync(objPath, content);
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
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add lib/version-store.ts lib/__tests__/version-store.test.ts
git commit -m "feat: add content-addressable object store"
```

---

### Task 5: Snapshot + State primitives

**Files:**
- Modify: `lib/version-store.ts`
- Modify: `lib/__tests__/version-store.test.ts`

Add snapshot creation (with dedup), listing, and state.json read/write.

- [ ] **Step 1: Write failing tests for snapshot + state**

Append to `lib/__tests__/version-store.test.ts`:

```typescript
import { createSnapshot, listSnapshots, getSnapshot, readState, writeState, type Snapshot, type ProfileState } from "../version-store";

describe("snapshots", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = path.join(os.tmpdir(), `vs-snap-${Date.now()}`);
    await mkdir(baseDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it("creates a snapshot and retrieves it", async () => {
    const tree = { "SKILL.md": await putObject(baseDir, "# Hello") };
    const snap = await createSnapshot(baseDir, {
      kind: "skill",
      itemName: "test-skill",
      source: "harness-hub",
      tree,
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
    expect(s1.id).toBe(s2.id); // dedup: no new snapshot written
  });

  it("lists snapshots in chronological order", async () => {
    const h1 = await putObject(baseDir, "v1");
    const h2 = await putObject(baseDir, "v2");
    await createSnapshot(baseDir, { kind: "agent", itemName: "a", source: "harness-hub", tree: { "a.md": h1 } });
    await createSnapshot(baseDir, { kind: "agent", itemName: "a", source: "external", tree: { "a.md": h2 } });
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
      version: 1,
      profileId: "test",
      homePath: "/tmp/test",
      files: {},
      skills: {},
      agents: {},
    };
    await writeState(baseDir, state);
    const read = await readState(baseDir);
    expect(read).toEqual(state);
  });

  it("returns null for missing state", async () => {
    const read = await readState(baseDir);
    expect(read).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Implement snapshot + state types and functions**

Append to `lib/version-store.ts`:

```typescript
// --- Types ---
export interface Snapshot {
  id: string;
  kind: "skill" | "agent";
  itemName: string;
  createdAt: number;
  source: "harness-hub" | "claude-hook" | "external" | "bootstrap" | "restore";
  label?: string;
  sourceSnapshotId?: string;
  tree: Record<string, string>; // relativePath → hash
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

// --- ULID-lite ---
function generateId(): string {
  const ts = Date.now().toString(36).padStart(9, "0");
  const rand = Array.from({ length: 8 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
  return `${ts}${rand}`;
}

// --- Snapshot helpers ---
function snapshotDir(baseDir: string, kind: string, name: string): string {
  return path.join(baseDir, "snapshots", kind, name);
}

function treeHash(tree: Record<string, string>): string {
  const sorted = Object.keys(tree).sort().map((k) => `${k}:${tree[k]}`).join("\n");
  return hashContent(sorted);
}

interface CreateSnapshotInput {
  kind: "skill" | "agent";
  itemName: string;
  source: Snapshot["source"];
  tree: Record<string, string>;
  label?: string;
  sourceSnapshotId?: string;
}

export async function createSnapshot(baseDir: string, input: CreateSnapshotInput): Promise<Snapshot> {
  const dir = snapshotDir(baseDir, input.kind, input.itemName);
  // Dedup: check if latest snapshot has the same tree hash
  const existing = await listSnapshots(baseDir, input.kind, input.itemName);
  if (existing.length > 0) {
    const latest = existing[existing.length - 1];
    if (treeHash(latest.tree) === treeHash(input.tree)) {
      return latest;
    }
  }

  const snap: Snapshot = {
    id: generateId(),
    kind: input.kind,
    itemName: input.itemName,
    createdAt: Date.now(),
    source: input.source,
    tree: input.tree,
    ...(input.label ? { label: input.label } : {}),
    ...(input.sourceSnapshotId ? { sourceSnapshotId: input.sourceSnapshotId } : {}),
  };

  await writeWithFsync(path.join(dir, `${snap.id}.json`), JSON.stringify(snap, null, 2));
  return snap;
}

export async function listSnapshots(baseDir: string, kind: string, name: string): Promise<Snapshot[]> {
  const dir = snapshotDir(baseDir, kind, name);
  try {
    const { readdir } = await import("fs/promises");
    const files = await readdir(dir);
    const snaps: Snapshot[] = [];
    for (const f of files) {
      if (!f.endsWith(".json") || f.startsWith("_")) continue;
      try {
        const raw = await readFile(path.join(dir, f), "utf-8");
        snaps.push(JSON.parse(raw));
      } catch { /* skip corrupted */ }
    }
    return snaps.sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

export async function getSnapshot(baseDir: string, kind: string, name: string, id: string): Promise<Snapshot | null> {
  try {
    const raw = await readFile(path.join(snapshotDir(baseDir, kind, name), `${id}.json`), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- State ---
export async function readState(baseDir: string): Promise<ProfileState | null> {
  try {
    const raw = await readFile(path.join(baseDir, "state.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeState(baseDir: string, state: ProfileState): Promise<void> {
  await writeWithFsync(path.join(baseDir, "state.json"), JSON.stringify(state, null, 2));
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Add boot integrity scan function**

Append to `lib/version-store.ts` — called on first profile load to verify every snapshot's referenced hashes exist in `objects/`. Per spec §7:

```typescript
export async function runIntegrityScan(baseDir: string): Promise<{ corruptedSnapshots: string[] }> {
  const corrupted: string[] = [];
  const state = await readState(baseDir);
  if (!state) return { corruptedSnapshots: [] };

  for (const kind of ["skill", "agent"] as const) {
    const store = kind === "skill" ? state.skills : state.agents;
    for (const [name] of Object.entries(store)) {
      const snaps = await listSnapshots(baseDir, kind, name);
      for (const snap of snaps) {
        for (const hash of Object.values(snap.tree)) {
          if (!(await hasObject(baseDir, hash))) {
            corrupted.push(snap.id);
            break;
          }
        }
      }
    }
  }
  return { corruptedSnapshots: corrupted };
}
```

- [ ] **Step 6: Add test for integrity scan**

```typescript
it("detects corrupted snapshots with missing objects", async () => {
  const hash = await putObject(baseDir, "exists");
  await createSnapshot(baseDir, { kind: "skill", itemName: "x", source: "bootstrap", tree: { "a.md": hash } });
  // Manually create a snapshot referencing a non-existent hash
  await createSnapshot(baseDir, { kind: "skill", itemName: "y", source: "bootstrap", tree: { "b.md": "sha256:0000000000000000000000000000000000000000000000000000000000000000" } });
  await writeState(baseDir, { version: 1, profileId: "t", homePath: "/t", files: {}, skills: { x: { currentSource: "bootstrap", currentSourceSnapshotId: null, latestSnapshotId: null, deletedAt: null, trashId: null, pinnedSnapshotIds: [] }, y: { currentSource: "bootstrap", currentSourceSnapshotId: null, latestSnapshotId: null, deletedAt: null, trashId: null, pinnedSnapshotIds: [] } }, agents: {} });
  const result = await runIntegrityScan(baseDir);
  expect(result.corruptedSnapshots.length).toBeGreaterThan(0);
});
```

- [ ] **Step 7: Run tests, verify pass**

- [ ] **Step 8: Commit**

```bash
git add lib/version-store.ts lib/__tests__/version-store.test.ts
git commit -m "feat: add snapshot creation, listing, state management, and integrity scan"
```

---

### Task 6: Add dependency — react-diff-viewer-continued

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

```bash
pnpm add react-diff-viewer-continued
```

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add react-diff-viewer-continued for version diff UI"
```

---

## Phase 3: Write Path Integration

### Task 7: Versioned write helper with per-item mutex

**Files:**
- Create: `lib/versioned-write.ts`
- Create: `lib/__tests__/versioned-write.test.ts`

The single write path that Skills/Agents PUT routes will delegate to. Handles conflict detection, pre-write external snapshot, post-write snapshot, state update.

- [ ] **Step 1: Write failing tests**

```typescript
// lib/__tests__/versioned-write.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeItem } from "../versioned-write";
import { readState, listSnapshots, getObject } from "../version-store";
import { writeFile, mkdir, rm, readFile } from "fs/promises";
import path from "path";
import os from "os";

describe("versioned-write", () => {
  let tmpDir: string;
  let homePath: string;
  let versionBase: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `vw-test-${Date.now()}`);
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

  it("creates a snapshot on write", async () => {
    await writeItem({
      versionBase,
      homePath,
      profileId: "test",
      kind: "skill",
      name: "my-skill",
      fileName: "SKILL.md",
      content: "# Updated",
      source: "harness-hub",
    });

    const snaps = await listSnapshots(versionBase, "skill", "my-skill");
    expect(snaps.length).toBeGreaterThanOrEqual(1);
    const disk = await readFile(path.join(homePath, "skills", "my-skill", "SKILL.md"), "utf-8");
    expect(disk).toBe("# Updated");
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

    // Now do another harness-hub write
    await writeItem({
      versionBase, homePath, profileId: "test",
      kind: "skill", name: "my-skill", fileName: "SKILL.md",
      content: "# V2", source: "harness-hub",
    });

    const snaps = await listSnapshots(versionBase, "skill", "my-skill");
    const sources = snaps.map((s) => s.source);
    expect(sources).toContain("external");
    expect(sources).toContain("harness-hub");
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Implement versioned-write**

```typescript
// lib/versioned-write.ts
import path from "path";
import { readFile, stat, readdir, open } from "fs/promises";
import { rename, mkdir } from "fs/promises";
import {
  hashContent, putObject, createSnapshot, readState, writeState,
  type ProfileState, type FileState, type ItemState,
} from "./version-store";

const mutexMap = new Map<string, Promise<void>>();

function withMutex(key: string, fn: () => Promise<void>): Promise<void> {
  const prev = mutexMap.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  mutexMap.set(key, next);
  return next;
}

const ALLOWED_EXTENSIONS = new Set([".md", ".json", ".txt", ".py", ".sh", ".yaml", ".yml", ".toml"]);
const IGNORED_NAMES = new Set([".DS_Store"]);

function shouldTrack(name: string): boolean {
  if (IGNORED_NAMES.has(name)) return false;
  if (name.endsWith("~") || name.startsWith("#") || name.endsWith(".swp")) return false;
  const ext = path.extname(name);
  return ALLOWED_EXTENSIONS.has(ext);
}

export async function scanItemTree(
  homePath: string,
  kind: "skill" | "agent",
  name: string,
): Promise<Record<string, { content: string; mtimeMs: number; size: number }>> {
  const base = kind === "skill"
    ? path.join(homePath, "skills", name)
    : path.join(homePath, "agents");

  const result: Record<string, { content: string; mtimeMs: number; size: number }> = {};

  if (kind === "agent") {
    const filePath = path.join(base, `${name}.md`);
    try {
      const content = await readFile(filePath, "utf-8");
      const s = await stat(filePath);
      result[`${name}.md`] = { content, mtimeMs: s.mtimeMs, size: s.size };
    } catch { /* file may not exist */ }
    return result;
  }

  // Skill: walk folder tree
  async function walk(dir: string, prefix: string): Promise<void> {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        await walk(path.join(dir, entry.name), rel);
      } else if (entry.isFile() && shouldTrack(entry.name)) {
        try {
          const content = await readFile(path.join(dir, entry.name), "utf-8");
          const s = await stat(path.join(dir, entry.name));
          result[rel] = { content, mtimeMs: s.mtimeMs, size: s.size };
        } catch { /* skip unreadable */ }
      }
    }
  }

  await walk(base, "");
  return result;
}

interface WriteItemInput {
  versionBase: string;
  homePath: string;
  profileId: string;
  kind: "skill" | "agent";
  name: string;
  fileName: string;     // the specific file being written (e.g. "SKILL.md")
  content: string;      // new content for that file
  source: "harness-hub";
}

export async function writeItem(input: WriteItemInput): Promise<void> {
  const mutexKey = `${input.profileId}:${input.kind}:${input.name}`;

  return withMutex(mutexKey, async () => {
    const { versionBase, homePath, profileId, kind, name, fileName, content } = input;

    // 1. Read current on-disk tree state
    const diskTree = await scanItemTree(homePath, kind, name);

    // 2. Hash the disk tree
    const diskHashes: Record<string, string> = {};
    for (const [rel, { content: c }] of Object.entries(diskTree)) {
      diskHashes[rel] = await putObject(versionBase, c);
    }

    // 3. Check drift against state.json
    let state = await readState(versionBase);
    if (!state) {
      state = { version: 1, profileId, homePath, files: {}, skills: {}, agents: {} };
    }
    const itemStore = kind === "skill" ? state.skills : state.agents;
    const itemState = itemStore[name];

    if (itemState?.latestSnapshotId) {
      // Compare stored hashes vs disk hashes
      const stateFiles = state.files;
      let drifted = false;
      for (const [rel, hash] of Object.entries(diskHashes)) {
        const stateKey = `${kind}/${name}/${rel}`;
        const known = stateFiles[stateKey];
        if (!known || known.hash !== hash) {
          drifted = true;
          break;
        }
      }
      if (drifted) {
        await createSnapshot(versionBase, {
          kind, itemName: name, source: "external",
          tree: diskHashes, label: "External edit",
        });
      }
    }

    // 4. Write the file to disk (tmp + fsync + rename)
    const targetPath = kind === "skill"
      ? path.join(homePath, "skills", name, fileName)
      : path.join(homePath, "agents", `${name}.md`);

    const tmpPath = targetPath + `.tmp.${Date.now()}`;
    const dir = path.dirname(targetPath);
    await mkdir(dir, { recursive: true });
    const fh = await open(tmpPath, "w");
    try {
      await fh.writeFile(content, "utf-8");
      await fh.sync();
    } finally {
      await fh.close();
    }
    await rename(tmpPath, targetPath);

    // 5. Re-scan and hash
    const newTree = await scanItemTree(homePath, kind, name);
    const newHashes: Record<string, string> = {};
    for (const [rel, { content: c, mtimeMs, size }] of Object.entries(newTree)) {
      const hash = await putObject(versionBase, c);
      newHashes[rel] = hash;
      const stateKey = `${kind}/${name}/${rel}`;
      state.files[stateKey] = { hash, size, mtimeMs, lastSeenAt: Date.now(), source: "harness-hub" };
    }

    // 6. Create post-write snapshot
    const snap = await createSnapshot(versionBase, {
      kind, itemName: name, source: "harness-hub", tree: newHashes,
    });

    // 7. Update item state
    itemStore[name] = {
      currentSource: "harness-hub",
      currentSourceSnapshotId: snap.id,
      latestSnapshotId: snap.id,
      deletedAt: null,
      trashId: null,
      pinnedSnapshotIds: itemState?.pinnedSnapshotIds ?? [],
    };

    // 8. Persist state
    await writeState(versionBase, state);
  });
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add lib/versioned-write.ts lib/__tests__/versioned-write.test.ts
git commit -m "feat: add versioned write helper with per-item mutex and drift detection"
```

---

### Task 8: Wire Skills PUT through versioned-write

**Files:**
- Modify: `app/api/skills/route.ts:80-103`
- Modify: `lib/api-client.ts`

- [ ] **Step 1: Add x-profile-id and x-user-data-path headers to api-client**

In `lib/api-client.ts`, modify `getApiHeaders()`:

```typescript
export function getApiHeaders(): Record<string, string> {
  const { profiles, activeProfileId } = useAppSettingsStore.getState();
  const profile = profiles.find((p) => p.id === activeProfileId);
  const headers: Record<string, string> = {};
  if (profile && profile.homePath !== "auto") {
    headers["x-claude-home"] = profile.homePath;
  }
  headers["x-profile-id"] = activeProfileId;
  // userDataPath is set by the Electron IPC handshake and stored globally
  const userDataPath = (globalThis as Record<string, unknown>).__harnessHubUserDataPath as string | undefined;
  if (userDataPath) {
    headers["x-user-data-path"] = userDataPath;
  }
  return headers;
}
```

- [ ] **Step 2: Update Skills PUT to use versioned-write when feature flag is on**

In `app/api/skills/route.ts`, replace the PUT handler body:

```typescript
export async function PUT(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const { name, content } = await request.json();

  if (!name || typeof content !== "string") {
    return NextResponse.json({ error: "name and content required" }, { status: 400 });
  }
  if (!isSafePathSegment(name)) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const dirPath = path.join(claudeHome, "skills", name);
  try {
    const files = await readdir(dirPath);
    const mdFile = files.find((f: string) => f === "SKILL.md")
      ?? files.filter((f: string) => f.endsWith(".md")).sort()[0];
    if (!mdFile) {
      return NextResponse.json({ error: "Skill file not found" }, { status: 404 });
    }

    // Version history integration
    const userDataPath = request.headers.get("x-user-data-path");
    const profileId = request.headers.get("x-profile-id");
    if (userDataPath && profileId && process.env.HARNESS_HUB_VERSION_HISTORY !== "0") {
      const { writeItem } = await import("@/lib/versioned-write");
      const versionBase = path.join(userDataPath, "versions", profileId);
      await writeItem({
        versionBase, homePath: claudeHome, profileId,
        kind: "skill", name, fileName: mdFile,
        content, source: "harness-hub",
      });
    } else {
      // Fallback: plain write (no version history)
      await writeFile(path.join(dirPath, mdFile), content, "utf-8");
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Apply the same deterministic primary-file selection to Skills GET**

In the GET handler where it selects the `.md` file, change `files.find(f => f.endsWith(".md"))` to the deterministic rule: prefer `SKILL.md`, else alphabetical first `.md`.

- [ ] **Step 4: Commit**

```bash
git add app/api/skills/route.ts lib/api-client.ts
git commit -m "feat: wire skills PUT through versioned-write with feature flag"
```

---

### Task 9: Wire Agents PUT through versioned-write

**Files:**
- Modify: `app/api/agents/route.ts:110-128`

- [ ] **Step 1: Update Agents PUT**

Same pattern as Task 8 step 2 but for agents:

```typescript
export async function PUT(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const { name, content } = await request.json();

  if (!name || typeof content !== "string") {
    return NextResponse.json({ error: "name and content required" }, { status: 400 });
  }
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const filePath = path.join(claudeHome, "agents", `${name}.md`);
  try {
    const userDataPath = request.headers.get("x-user-data-path");
    const profileId = request.headers.get("x-profile-id");
    if (userDataPath && profileId && process.env.HARNESS_HUB_VERSION_HISTORY !== "0") {
      const { writeItem } = await import("@/lib/versioned-write");
      const versionBase = path.join(userDataPath, "versions", profileId);
      await writeItem({
        versionBase, homePath: claudeHome, profileId,
        kind: "agent", name, fileName: `${name}.md`,
        content, source: "harness-hub",
      });
    } else {
      await writeFile(filePath, content, "utf-8");
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/agents/route.ts
git commit -m "feat: wire agents PUT through versioned-write with feature flag"
```

---

## Phase 4: Detection

### Task 10: External rescan walker

**Files:**
- Create: `lib/external-rescan.ts`
- Create: `lib/__tests__/external-rescan.test.ts`

Walks `homePath/skills/*` and `homePath/agents/*.md`, compares to state.json, creates external snapshots for drifted items.

- [ ] **Step 1: Write failing tests**

```typescript
// lib/__tests__/external-rescan.test.ts
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
    await runRescan({ versionBase, homePath, profileId: "test" });

    const skillSnaps = await listSnapshots(versionBase, "skill", "foo");
    const agentSnaps = await listSnapshots(versionBase, "agent", "bar");
    expect(skillSnaps.length).toBe(1);
    expect(agentSnaps.length).toBe(1);
  });

  it("detects external changes to a tracked file", async () => {
    await writeFile(path.join(homePath, "skills", "foo", "SKILL.md"), "# V1");
    await runRescan({ versionBase, homePath, profileId: "test" });

    // Simulate external edit
    await writeFile(path.join(homePath, "skills", "foo", "SKILL.md"), "# V2");
    const report = await runRescan({ versionBase, homePath, profileId: "test" });

    const snaps = await listSnapshots(versionBase, "skill", "foo");
    expect(snaps.length).toBe(2);
    expect(snaps[1].source).toBe("external");
  });

  it("soft-deletes items that disappeared from disk", async () => {
    await writeFile(path.join(homePath, "skills", "foo", "SKILL.md"), "# Gone");
    await runRescan({ versionBase, homePath, profileId: "test" });

    // Remove the skill folder
    await rm(path.join(homePath, "skills", "foo"), { recursive: true });
    await runRescan({ versionBase, homePath, profileId: "test" });

    const state = await readState(versionBase);
    expect(state?.skills.foo.deletedAt).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Implement external-rescan**

```typescript
// lib/external-rescan.ts
import path from "path";
import { readdir, stat } from "fs/promises";
import {
  hashContent, putObject, createSnapshot, readState, writeState,
  type ProfileState, type ItemState,
} from "./version-store";
import { scanItemTree } from "./versioned-write";

interface RescanInput {
  versionBase: string;
  homePath: string;
  profileId: string;
  /** Optional: rescan only this specific item */
  scopedItem?: { kind: "skill" | "agent"; name: string };
}

export interface RescanReport {
  newItems: string[];
  driftedItems: string[];
  deletedItems: string[];
}

export async function runRescan(input: RescanInput): Promise<RescanReport> {
  const { versionBase, homePath, profileId, scopedItem } = input;
  const report: RescanReport = { newItems: [], driftedItems: [], deletedItems: [] };

  let state = await readState(versionBase);
  if (!state) {
    state = { version: 1, profileId, homePath, files: {}, skills: {}, agents: {} };
  }

  // §9.3: homePath drift detection — if stored homePath differs from current,
  // archive the old state and start fresh
  if (state.homePath && state.homePath !== homePath) {
    const { rename: renameDir } = await import("fs/promises");
    const timestamp = Date.now();
    try {
      await renameDir(
        path.join(versionBase, "state.json"),
        path.join(versionBase, `state.archived-${timestamp}.json`),
      );
    } catch { /* may not exist */ }
    state = { version: 1, profileId, homePath, files: {}, skills: {}, agents: {} };
  }

  // Discover current items on disk
  const diskItems: { kind: "skill" | "agent"; name: string }[] = [];

  if (!scopedItem || scopedItem.kind === "skill") {
    const skillsDir = path.join(homePath, "skills");
    try {
      const entries = await readdir(skillsDir, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory() || e.name.startsWith(".")) continue;
        if (scopedItem && scopedItem.name !== e.name) continue;
        diskItems.push({ kind: "skill", name: e.name });
      }
    } catch { /* skills dir may not exist */ }
  }

  if (!scopedItem || scopedItem.kind === "agent") {
    const agentsDir = path.join(homePath, "agents");
    try {
      const entries = await readdir(agentsDir);
      for (const e of entries) {
        if (!e.endsWith(".md")) continue;
        const name = e.replace(".md", "");
        if (scopedItem && scopedItem.name !== name) continue;
        diskItems.push({ kind: "agent", name });
      }
    } catch { /* agents dir may not exist */ }
  }

  // Process each disk item
  for (const item of diskItems) {
    const tree = await scanItemTree(homePath, item.kind, item.name);
    const hashes: Record<string, string> = {};
    for (const [rel, { content }] of Object.entries(tree)) {
      hashes[rel] = await putObject(versionBase, content);
    }

    const store = item.kind === "skill" ? state.skills : state.agents;
    const existing = store[item.name];

    if (!existing || !existing.latestSnapshotId) {
      // New item → bootstrap snapshot
      const snap = await createSnapshot(versionBase, {
        kind: item.kind, itemName: item.name,
        source: existing ? "external" : "bootstrap",
        tree: hashes,
      });
      store[item.name] = {
        currentSource: existing ? "external" : "bootstrap",
        currentSourceSnapshotId: snap.id,
        latestSnapshotId: snap.id,
        deletedAt: null, trashId: null,
        pinnedSnapshotIds: existing?.pinnedSnapshotIds ?? [],
      };
      for (const [rel, { mtimeMs, size }] of Object.entries(tree)) {
        state.files[`${item.kind}/${item.name}/${rel}`] = {
          hash: hashes[rel], size, mtimeMs, lastSeenAt: Date.now(),
          source: "external",
        };
      }
      report.newItems.push(`${item.kind}/${item.name}`);
    } else {
      // Check for drift
      let drifted = false;
      for (const [rel, hash] of Object.entries(hashes)) {
        const key = `${item.kind}/${item.name}/${rel}`;
        if (!state.files[key] || state.files[key].hash !== hash) {
          drifted = true;
          break;
        }
      }
      if (drifted) {
        const snap = await createSnapshot(versionBase, {
          kind: item.kind, itemName: item.name,
          source: "external", tree: hashes, label: "External edit",
        });
        store[item.name] = {
          ...existing,
          currentSource: "external",
          currentSourceSnapshotId: snap.id,
          latestSnapshotId: snap.id,
        };
        for (const [rel, { mtimeMs, size }] of Object.entries(tree)) {
          state.files[`${item.kind}/${item.name}/${rel}`] = {
            hash: hashes[rel], size, mtimeMs, lastSeenAt: Date.now(),
            source: "external",
          };
        }
        report.driftedItems.push(`${item.kind}/${item.name}`);
      }
    }
  }

  // Detect deletions (items in state but not on disk) — only for full rescan
  if (!scopedItem) {
    for (const [name, itemState] of Object.entries(state.skills)) {
      if (itemState.deletedAt) continue;
      if (!diskItems.find((d) => d.kind === "skill" && d.name === name)) {
        state.skills[name] = { ...itemState, deletedAt: Date.now(), trashId: `trash-${Date.now()}` };
        report.deletedItems.push(`skill/${name}`);
      }
    }
    for (const [name, itemState] of Object.entries(state.agents)) {
      if (itemState.deletedAt) continue;
      if (!diskItems.find((d) => d.kind === "agent" && d.name === name)) {
        state.agents[name] = { ...itemState, deletedAt: Date.now(), trashId: `trash-${Date.now()}` };
        report.deletedItems.push(`agent/${name}`);
      }
    }
  }

  await writeState(versionBase, state);
  return report;
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add lib/external-rescan.ts lib/__tests__/external-rescan.test.ts
git commit -m "feat: add external rescan walker with bootstrap and drift detection"
```

---

### Task 11: /api/rescan endpoint

**Files:**
- Create: `app/api/rescan/route.ts`

Accepts POST from: (a) the Claude Code hook payload, (b) the renderer on launch/focus (no body = full rescan).

- [ ] **Step 1: Create the route**

```typescript
// app/api/rescan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import path from "path";

export async function POST(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const userDataPath = request.headers.get("x-user-data-path");
  const profileId = request.headers.get("x-profile-id");

  if (!userDataPath || !profileId) {
    return NextResponse.json({ error: "Version history not available" }, { status: 503 });
  }

  const versionBase = path.join(userDataPath, "versions", profileId);
  const { runRescan } = await import("@/lib/external-rescan");

  let scopedItem: { kind: "skill" | "agent"; name: string } | undefined;

  // Check if this is a Claude Code hook payload
  const contentType = request.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    try {
      const body = await request.json();
      const filePath: string | undefined = body?.tool_input?.file_path;
      if (filePath) {
        // Derive kind and name from the file path
        const skillsDir = path.join(claudeHome, "skills");
        const agentsDir = path.join(claudeHome, "agents");
        if (filePath.startsWith(skillsDir + path.sep)) {
          const rel = filePath.slice(skillsDir.length + 1);
          const name = rel.split(path.sep)[0];
          if (name) scopedItem = { kind: "skill", name };
        } else if (filePath.startsWith(agentsDir + path.sep)) {
          const fileName = path.basename(filePath, ".md");
          if (fileName) scopedItem = { kind: "agent", name: fileName };
        } else {
          // File is not under skills/ or agents/ — skip
          return NextResponse.json({ skipped: true, reason: "file not tracked" });
        }
      }
    } catch { /* empty body = full rescan */ }
  }

  const report = await runRescan({ versionBase, homePath: claudeHome, profileId, scopedItem });
  return NextResponse.json(report);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/rescan/route.ts
git commit -m "feat: add /api/rescan endpoint for external edit detection"
```

---

### Task 12: /api/version-history endpoint

**Files:**
- Create: `app/api/version-history/route.ts`

Provides list, get, restore, pin/unpin, and archiveProfile operations.

- [ ] **Step 1: Create the route**

```typescript
// app/api/version-history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import path from "path";

export async function GET(request: NextRequest) {
  const userDataPath = request.headers.get("x-user-data-path");
  const profileId = request.headers.get("x-profile-id");
  if (!userDataPath || !profileId) {
    return NextResponse.json({ error: "Version history not available" }, { status: 503 });
  }

  const versionBase = path.join(userDataPath, "versions", profileId);
  const action = request.nextUrl.searchParams.get("action") ?? "list";
  const kind = request.nextUrl.searchParams.get("kind") as "skill" | "agent";
  const name = request.nextUrl.searchParams.get("name") ?? "";

  const { listSnapshots, getSnapshot, getObject } = await import("@/lib/version-store");

  if (action === "list") {
    const snaps = await listSnapshots(versionBase, kind, name);
    return NextResponse.json({ snapshots: snaps });
  }

  if (action === "get") {
    const id = request.nextUrl.searchParams.get("id") ?? "";
    const snap = await getSnapshot(versionBase, kind, name, id);
    if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Resolve object contents for diff display
    const contents: Record<string, string> = {};
    for (const [rel, hash] of Object.entries(snap.tree)) {
      try { contents[rel] = await getObject(versionBase, hash); } catch { contents[rel] = ""; }
    }
    return NextResponse.json({ snapshot: snap, contents });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const claudeHome = getClaudeHomeFromRequest(request);
  const userDataPath = request.headers.get("x-user-data-path");
  const profileId = request.headers.get("x-profile-id");
  if (!userDataPath || !profileId) {
    return NextResponse.json({ error: "Version history not available" }, { status: 503 });
  }

  const versionBase = path.join(userDataPath, "versions", profileId);
  const body = await request.json();
  const { action, kind, name, snapshotId } = body;

  if (action === "restore") {
    const { getSnapshot, getObject, createSnapshot, readState, writeState } = await import("@/lib/version-store");
    const { scanItemTree } = await import("@/lib/versioned-write");
    const { writeFile, mkdir, rm: rmdir } = await import("fs/promises");

    const snap = await getSnapshot(versionBase, kind, name, snapshotId);
    if (!snap) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });

    // Create pre-restore snapshot
    const currentTree = await scanItemTree(claudeHome, kind, name);
    const currentHashes: Record<string, string> = {};
    for (const [rel, { content }] of Object.entries(currentTree)) {
      currentHashes[rel] = await (await import("@/lib/version-store")).putObject(versionBase, content);
    }
    await createSnapshot(versionBase, {
      kind, itemName: name, source: "restore",
      tree: currentHashes, label: "Pre-restore snapshot",
    });

    // Materialize the target snapshot to disk
    const basePath = kind === "skill"
      ? path.join(claudeHome, "skills", name)
      : path.join(claudeHome, "agents");

    if (kind === "skill") {
      // Remove existing files, write snapshot files
      const existingFiles = Object.keys(currentTree);
      for (const rel of existingFiles) {
        if (!(rel in snap.tree)) {
          try { await rmdir(path.join(basePath, rel)); } catch {}
        }
      }
    }

    for (const [rel, hash] of Object.entries(snap.tree)) {
      const content = await getObject(versionBase, hash);
      const filePath = kind === "skill" ? path.join(basePath, rel) : path.join(basePath, `${name}.md`);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf-8");
    }

    // Create post-restore snapshot
    const restoredSnap = await createSnapshot(versionBase, {
      kind, itemName: name, source: "restore",
      tree: snap.tree, label: `Restored from ${snapshotId}`,
      sourceSnapshotId: snapshotId,
    });

    return NextResponse.json({ success: true, restoredSnapshot: restoredSnap });
  }

  if (action === "pin" || action === "unpin") {
    const { readState, writeState } = await import("@/lib/version-store");
    const state = await readState(versionBase);
    if (!state) return NextResponse.json({ error: "No state" }, { status: 404 });
    const store = kind === "skill" ? state.skills : state.agents;
    const item = store[name];
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    if (action === "pin" && !item.pinnedSnapshotIds.includes(snapshotId)) {
      item.pinnedSnapshotIds.push(snapshotId);
    } else if (action === "unpin") {
      item.pinnedSnapshotIds = item.pinnedSnapshotIds.filter((id: string) => id !== snapshotId);
    }
    await writeState(versionBase, state);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const userDataPath = request.headers.get("x-user-data-path");
  const profileId = request.nextUrl.searchParams.get("id");
  const action = request.nextUrl.searchParams.get("action");

  if (action === "archiveProfile" && profileId && userDataPath) {
    const { rename, mkdir } = await import("fs/promises");
    const srcDir = path.join(userDataPath, "versions", profileId);
    const archiveDir = path.join(userDataPath, "versions", "_archived");
    await mkdir(archiveDir, { recursive: true });
    try {
      await rename(srcDir, path.join(archiveDir, `${Date.now()}_${profileId}`));
    } catch { /* dir may not exist */ }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/version-history/route.ts
git commit -m "feat: add /api/version-history endpoint for list, restore, pin"
```

---

## Phase 5: Renderer Integration

### Task 13: Version history Zustand store

**Files:**
- Create: `stores/version-history-store.ts`

Client-side state for the history panel: selected item, open/closed, cached snapshots.

- [ ] **Step 1: Create the store**

```typescript
// stores/version-history-store.ts
import { create } from "zustand";

interface VersionHistoryState {
  userDataPath: string | null;
  isHistoryOpen: boolean;
  selectedSnapshotId: string | null;
  compareSnapshotId: string | null;

  setUserDataPath: (path: string) => void;
  toggleHistory: () => void;
  openHistory: () => void;
  closeHistory: () => void;
  selectSnapshot: (id: string | null) => void;
  setCompareSnapshot: (id: string | null) => void;
  resetForProfile: () => void;
}

export const useVersionHistoryStore = create<VersionHistoryState>()((set) => ({
  userDataPath: null,
  isHistoryOpen: false,
  selectedSnapshotId: null,
  compareSnapshotId: null,

  setUserDataPath: (path) => set({ userDataPath: path }),
  toggleHistory: () => set((s) => ({ isHistoryOpen: !s.isHistoryOpen })),
  openHistory: () => set({ isHistoryOpen: true }),
  closeHistory: () => set({ isHistoryOpen: false }),
  selectSnapshot: (id) => set({ selectedSnapshotId: id }),
  setCompareSnapshot: (id) => set({ compareSnapshotId: id }),
  resetForProfile: () => set({
    isHistoryOpen: false,
    selectedSnapshotId: null,
    compareSnapshotId: null,
  }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add stores/version-history-store.ts
git commit -m "feat: add version history Zustand store"
```

---

### Task 14: Layout mount effect — IPC handshake + launch rescan + profile subscription

**Files:**
- Modify: `app/layout.tsx`

Add a client component wrapper that handles the Electron IPC handshake on mount, subscribes to profile changes, and triggers the initial rescan.

- [ ] **Step 1: Create a client-side provider component**

Create `components/version-history-provider.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useVersionHistoryStore } from "@/stores/version-history-store";
import { apiFetch } from "@/lib/api-client";

declare global {
  interface Window {
    electronVersionStore?: {
      getBasePath: () => Promise<string>;
      onWindowRegainFocus: (cb: () => void) => () => void;
    };
  }
}

export function VersionHistoryProvider({ children }: { children: React.ReactNode }) {
  const setUserDataPath = useVersionHistoryStore((s) => s.setUserDataPath);
  const resetForProfile = useVersionHistoryStore((s) => s.resetForProfile);

  useEffect(() => {
    let focusCleanup: (() => void) | undefined;
    let debounceTimer: ReturnType<typeof setTimeout>;

    async function init() {
      // IPC handshake — get userData path from Electron
      if (window.electronVersionStore) {
        try {
          const basePath = await window.electronVersionStore.getBasePath();
          setUserDataPath(basePath);
          (globalThis as Record<string, unknown>).__harnessHubUserDataPath = basePath;
        } catch { /* non-Electron environment */ }
      }

      // Trigger launch rescan (also handles homePath drift detection per §9.3:
      // the rescan route checks state.json.homePath vs current profile.homePath
      // and archives the old state if they differ, then bootstraps fresh)
      try {
        await apiFetch("/api/rescan", { method: "POST" });
      } catch { /* best effort */ }

      // Listen for focus events (debounced)
      if (window.electronVersionStore) {
        focusCleanup = window.electronVersionStore.onWindowRegainFocus(() => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            apiFetch("/api/rescan", { method: "POST" }).catch(() => {});
          }, 2000);
        });
      }
    }

    init();

    // Subscribe to profile changes
    const unsub = useAppSettingsStore.subscribe(
      (state) => state.activeProfileId,
      () => {
        resetForProfile();
        apiFetch("/api/rescan", { method: "POST" }).catch(() => {});
      },
    );

    return () => {
      unsub();
      focusCleanup?.();
      clearTimeout(debounceTimer);
    };
  }, [setUserDataPath, resetForProfile]);

  return <>{children}</>;
}
```

- [ ] **Step 2: Wire into app/layout.tsx**

Import and wrap the children with `<VersionHistoryProvider>`. The provider renders children through and adds no visible UI.

- [ ] **Step 3: Commit**

```bash
git add components/version-history-provider.tsx app/layout.tsx
git commit -m "feat: add version history provider with IPC handshake, rescan, and profile subscription"
```

---

## Phase 6: Claude Code Hook

### Task 15: Hook installer

**Files:**
- Create: `lib/claude-hook-installer.ts`
- Create: `lib/__tests__/claude-hook-installer.test.ts`

Idempotent install/uninstall of the PostToolUse HTTP hook into `~/.claude/settings.json`.

- [ ] **Step 1: Write failing tests**

```typescript
// lib/__tests__/claude-hook-installer.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installHook, uninstallHook, isHookInstalled } from "../claude-hook-installer";
import { writeFile, mkdir, rm, readFile } from "fs/promises";
import path from "path";
import os from "os";

describe("claude-hook-installer", () => {
  let tmpDir: string;
  let settingsPath: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `hook-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    settingsPath = path.join(tmpDir, "settings.json");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("installs hook into empty settings", async () => {
    await writeFile(settingsPath, "{}");
    await installHook(settingsPath);
    const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
    expect(settings.hooks?.PostToolUse).toBeDefined();
    expect(settings.hooks.PostToolUse).toHaveLength(1);
    expect(settings.hooks.PostToolUse[0].matcher).toBe("Edit|Write");
  });

  it("installs hook into settings with existing hooks", async () => {
    await writeFile(settingsPath, JSON.stringify({
      hooks: { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }] },
    }));
    await installHook(settingsPath);
    const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
    expect(settings.hooks.PostToolUse).toHaveLength(2); // existing + ours
  });

  it("is idempotent", async () => {
    await writeFile(settingsPath, "{}");
    await installHook(settingsPath);
    await installHook(settingsPath);
    const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
    expect(settings.hooks.PostToolUse).toHaveLength(1);
  });

  it("uninstalls cleanly", async () => {
    await writeFile(settingsPath, "{}");
    await installHook(settingsPath);
    await uninstallHook(settingsPath);
    const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
    expect(settings.hooks.PostToolUse).toHaveLength(0);
  });

  it("uninstall leaves unrelated hooks untouched", async () => {
    await writeFile(settingsPath, JSON.stringify({
      hooks: { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }] },
    }));
    await installHook(settingsPath);
    await uninstallHook(settingsPath);
    const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
    expect(settings.hooks.PostToolUse).toHaveLength(1);
    expect(settings.hooks.PostToolUse[0].matcher).toBe("Bash");
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Implement**

```typescript
// lib/claude-hook-installer.ts
import { readFile, writeFile, stat, copyFile, rename } from "fs/promises";

const HARNESS_HUB_URL = "http://127.0.0.1:3000/api/rescan";
const HARNESS_HUB_HEADER_KEY = "x-harness-hub-hook";

interface HookEntry {
  matcher: string;
  hooks: Array<{ type: string; url?: string; command?: string; headers?: Record<string, string>; [k: string]: unknown }>;
}

function isOurEntry(entry: HookEntry): boolean {
  return entry.hooks?.some(
    (h) => h.type === "http" && h.url === HARNESS_HUB_URL && h.headers?.[HARNESS_HUB_HEADER_KEY] === "1"
  ) ?? false;
}

function ourEntry(): HookEntry {
  return {
    matcher: "Edit|Write",
    hooks: [{
      type: "http",
      url: HARNESS_HUB_URL,
      headers: { [HARNESS_HUB_HEADER_KEY]: "1" },
    }],
  };
}

async function readSettings(path: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return {};
  }
}

async function writeSettings(settingsPath: string, data: Record<string, unknown>): Promise<void> {
  const backupPath = settingsPath.replace(/\.json$/, ".backup.json");
  try { await copyFile(settingsPath, backupPath); } catch { /* no existing file */ }
  const tmpPath = settingsPath + `.tmp.${Date.now()}`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  await rename(tmpPath, settingsPath);
}

export async function installHook(settingsPath: string): Promise<void> {
  const settings = await readSettings(settingsPath);
  if (!settings.hooks || typeof settings.hooks !== "object") {
    settings.hooks = {};
  }
  const hooks = settings.hooks as Record<string, unknown[]>;
  if (!Array.isArray(hooks.PostToolUse)) {
    hooks.PostToolUse = [];
  }
  // Check if already installed
  if ((hooks.PostToolUse as HookEntry[]).some(isOurEntry)) return;
  (hooks.PostToolUse as HookEntry[]).push(ourEntry());
  await writeSettings(settingsPath, settings);
}

export async function uninstallHook(settingsPath: string): Promise<void> {
  const settings = await readSettings(settingsPath);
  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  if (!Array.isArray(hooks.PostToolUse)) return;
  hooks.PostToolUse = (hooks.PostToolUse as HookEntry[]).filter((e) => !isOurEntry(e));
  await writeSettings(settingsPath, settings);
}

export async function isHookInstalled(settingsPath: string): Promise<boolean> {
  const settings = await readSettings(settingsPath);
  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  if (!Array.isArray(hooks.PostToolUse)) return false;
  return (hooks.PostToolUse as HookEntry[]).some(isOurEntry);
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add lib/claude-hook-installer.ts lib/__tests__/claude-hook-installer.test.ts
git commit -m "feat: add idempotent Claude Code hook installer"
```

---

## Phase 7: UI Components

### Task 16: Version History Panel component

**Files:**
- Create: `components/version-history-panel.tsx`

The right-side panel showing chronological version list with source labels, pin toggle, and action buttons.

- [ ] **Step 1: Create the component**

Build a panel component that accepts `kind`, `name`, `profileId` props and uses `apiFetch` to load snapshots from `/api/version-history?action=list`. Renders a chronological list with:
- Timestamp + source label (harness-hub / Claude hook / External / Bootstrap)
- Pin toggle (star icon)
- "Compare" and "Restore" action buttons
- Filter tabs: All / Pinned / By source

Reference the spec §10.2 for the exact row layout. Use Tailwind classes consistent with the existing amber accent palette. Keep the component under 200 lines JSX by extracting a `VersionRow` sub-component.

- [ ] **Step 2: Commit**

```bash
git add components/version-history-panel.tsx
git commit -m "feat: add version history panel component"
```

---

### Task 17: Version Diff View component

**Files:**
- Create: `components/version-diff-view.tsx`

Wraps `react-diff-viewer-continued` for split-mode diff rendering. For multi-file skill snapshots, provides a file list on the left.

- [ ] **Step 1: Create the component**

```typescript
// components/version-diff-view.tsx
"use client";

import { useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

interface DiffViewProps {
  oldContents: Record<string, string>;  // relativePath → content
  newContents: Record<string, string>;
  oldLabel: string;  // e.g. "v12 · 2026-04-09 14:30"
  newLabel: string;
}

export function VersionDiffView({ oldContents, newContents, oldLabel, newLabel }: DiffViewProps) {
  const allFiles = [...new Set([...Object.keys(oldContents), ...Object.keys(newContents)])].sort();
  const changedFiles = allFiles.filter((f) => (oldContents[f] ?? "") !== (newContents[f] ?? ""));
  const [selectedFile, setSelectedFile] = useState(changedFiles[0] ?? allFiles[0]);

  if (allFiles.length === 0) {
    return <div className="text-center text-gray-400 py-8">No files to compare</div>;
  }

  return (
    <div className="flex h-full">
      {allFiles.length > 1 && (
        <div className="w-48 shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-2 space-y-0.5">
          {changedFiles.map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFile(f)}
              className={`w-full text-left px-2 py-1.5 text-xs rounded-md truncate transition-colors ${
                selectedFile === f
                  ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {f}
            </button>
          ))}
          {allFiles.length > changedFiles.length && (
            <div className="px-2 py-1 text-[10px] text-gray-400">
              {allFiles.length - changedFiles.length} unchanged files hidden
            </div>
          )}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <ReactDiffViewer
          oldValue={oldContents[selectedFile] ?? ""}
          newValue={newContents[selectedFile] ?? ""}
          splitView
          compareMethod={DiffMethod.WORDS}
          leftTitle={`${selectedFile} — ${oldLabel}`}
          rightTitle={`${selectedFile} — ${newLabel}`}
          useDarkTheme={typeof document !== "undefined" && document.documentElement.classList.contains("dark")}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/version-diff-view.tsx
git commit -m "feat: add version diff view component with multi-file support"
```

---

### Task 18: External Edit Banner component

**Files:**
- Create: `components/external-edit-banner.tsx`

Amber banner shown at the top of the editor when the current item has been modified externally.

- [ ] **Step 1: Create the component**

```typescript
// components/external-edit-banner.tsx
"use client";

import { useState } from "react";

interface ExternalEditBannerProps {
  source: string;       // "external" | "claude-hook"
  timestamp: number;
  onViewChanges: () => void;
  onRevert: () => void;
}

export function ExternalEditBanner({ source, timestamp, onViewChanges, onRevert }: ExternalEditBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const sourceLabel = source === "claude-hook" ? "Claude Code" : "an external tool";
  const timeStr = new Date(timestamp).toLocaleString();

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>
      </svg>
      <span className="flex-1">
        Modified by {sourceLabel} · {timeStr}
      </span>
      <button onClick={onViewChanges} className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors font-medium">
        View changes
      </button>
      <button onClick={onRevert} className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors font-medium">
        Revert
      </button>
      <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 transition-colors" aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/external-edit-banner.tsx
git commit -m "feat: add external edit banner component"
```

---

### Task 19: Trash Section component

**Files:**
- Create: `components/trash-section.tsx`

Collapsible "Deleted (N)" section at the bottom of Skills/Agents list.

- [ ] **Step 1: Create the component**

Build a collapsible section that accepts `trashedItems: Array<{ name: string; kind: string; deletedAt: number; trashId: string }>` and `onRestore(name)` / `onPermanentDelete(name)` callbacks. Use the same Tailwind styling conventions as the existing list items. Keep under 80 lines.

- [ ] **Step 2: Commit**

```bash
git add components/trash-section.tsx
git commit -m "feat: add trash section component for deleted items"
```

---

### Task 20: Wire history UI into Skills page

**Files:**
- Modify: `app/skills/page.tsx:260-284`

Add the nested `Group` layout for the history panel inside the detail `Panel`. Add the History button to the toolbar area. Add the external edit banner above the viewer. Add the trash section below the custom skills list.

- [ ] **Step 1: Implement the nested panel layout**

In the desktop section (`hidden lg:block`), modify the detail Panel's content to conditionally render a nested `Group` when `isHistoryOpen`:

```tsx
<Panel id="detail" minSize="40%">
  <div className="h-full overflow-y-auto pr-1">
    {selected ? (
      isHistoryOpen ? (
        <Group id="detail-inner" orientation="horizontal">
          <Panel id="editor-area" defaultSize={70} minSize={40}>
            {/* ExternalEditBanner conditionally */}
            {breadcrumb}
            <MarkdownViewer ... />
          </Panel>
          <ResizeHandle />
          <Panel id="history-area" defaultSize={30} minSize={20}>
            <VersionHistoryPanel kind="skill" name={selected.name} />
          </Panel>
        </Group>
      ) : (
        <>
          {breadcrumb}
          <MarkdownViewer ... />
        </>
      )
    ) : (
      <div className="...">Select a skill to view</div>
    )}
  </div>
</Panel>
```

Add a "History" button next to the existing list items using the same styling as "Edit" in `MarkdownViewer`'s toolbar.

- [ ] **Step 2: Add trash section below the custom skills list**

After the `createForm` in `skillList`, render `<TrashSection>` with deleted items from state.

- [ ] **Step 3: Add mobile history navigation**

In the mobile section (`lg:hidden`, ~line 240-258), when `selected` is set and user taps "History", navigate into a nested mobile view. Follow the existing "Back to list" pattern:

```tsx
{/* Inside the mobile branch, add a historyView state: */}
{mobileHistoryOpen ? (
  <div>
    <button onClick={() => setMobileHistoryOpen(false)} className="mb-3 flex items-center gap-1 text-sm text-gray-500 ...">
      <svg ...><path d="m15 18-6-6 6-6"/></svg>
      Back to detail
    </button>
    <VersionHistoryPanel kind="skill" name={selected.name} mobileMode />
  </div>
) : (
  /* existing detail view + a "History" button that sets mobileHistoryOpen=true */
)}
```

The `VersionHistoryPanel` with `mobileMode` prop renders a vertical list without the split diff — tapping a version shows a unified diff inline (single-file, no split view). Per spec §10.7.

- [ ] **Step 4: Manual verification**

Open a custom skill, click History, verify the panel slides in on desktop. On mobile (narrow viewport), verify the nested navigation works.

- [ ] **Step 5: Commit**

```bash
git add app/skills/page.tsx
git commit -m "feat: wire version history UI into Skills page with mobile support"
```

---

### Task 21: Wire history UI into Agents page

**Files:**
- Modify: `app/agents/page.tsx:329-351`

Same pattern as Task 20 but for the Agents Definitions tab.

- [ ] **Step 1: Apply the same nested Panel layout + History button + Trash section**

Follow exactly the same pattern as Skills page. The `VersionHistoryPanel` receives `kind="agent"` instead.

- [ ] **Step 2: Commit**

```bash
git add app/agents/page.tsx
git commit -m "feat: wire version history UI into Agents page"
```

---

### Task 22: App Settings — hook toggle + archived histories + cleanup

**Files:**
- Modify: `app/app-settings/page.tsx`

Add three sections: (1) "Claude Code Hook" toggle with JSON preview, (2) "Archived Histories" list, (3) "Clean up orphaned objects" button.

- [ ] **Step 1: Add hook toggle section**

Add a toggle switch with `isHookInstalled` / `installHook` / `uninstallHook` integration. Show the exact JSON fragment that will be written to `~/.claude/settings.json`. Default off (opt-in).

- [ ] **Step 2: Add archived histories section**

List `state.archived-*.json` files from the active profile's version directory. Each row shows timestamp + "Browse" / "Delete" buttons.

- [ ] **Step 3: Add cleanup button**

A "Clean up orphaned objects" button that calls a new endpoint (or extends `/api/version-history?action=cleanup`).

- [ ] **Step 4: Commit**

```bash
git add app/app-settings/page.tsx
git commit -m "feat: add hook toggle, archived histories, and cleanup to App Settings"
```

---

### Task 23: Wire removeProfile cleanup

**Files:**
- Modify: `stores/app-settings-store.ts:126-131`

- [ ] **Step 1: Add API call to removeProfile**

```typescript
removeProfile: (id) => {
  // Best-effort version history cleanup
  apiFetch(`/api/version-history?action=archiveProfile&id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).catch(() => {});
  set((state) => ({
    profiles: state.profiles.filter((p) => p.id !== id),
    activeProfileId: state.activeProfileId === id ? "default" : state.activeProfileId,
  }));
},
```

Note: import `apiFetch` from `@/lib/api-client` at the top of the store file.

- [ ] **Step 2: Commit**

```bash
git add stores/app-settings-store.ts
git commit -m "feat: wire profile delete to version history archive cleanup"
```

---

## Phase 8: Finalization

### Task 24: Feature documentation + README

**Files:**
- Create: `docs/features/version-history.md`
- Modify: `README.md`

Per project CLAUDE.md HARD GATE: every new feature must have docs + README entry.

- [ ] **Step 1: Write feature docs**

Create `docs/features/version-history.md` covering: role, capabilities, data sources, API endpoints, related files.

- [ ] **Step 2: Update README features table**

Add an entry for Version History with a link to `docs/features/version-history.md`.

- [ ] **Step 3: Remove feature flag**

If the feature flag `HARNESS_HUB_VERSION_HISTORY` was still gating, remove the env check and make it always-on.

- [ ] **Step 4: Commit**

```bash
git add docs/features/version-history.md README.md app/api/skills/route.ts app/api/agents/route.ts
git commit -m "docs: add version history feature docs and enable by default"
```

---

## Summary

| Phase | Tasks | Focus |
|---|---|---|
| 1. Prerequisites | 1-3 | Bug fix, IPC, path validator |
| 2. Core | 4-6 | Object store, snapshots, state, diff dep |
| 3. Write path | 7-9 | Versioned write + route wiring |
| 4. Detection | 10-12 | Rescan, /api/rescan, /api/version-history |
| 5. Renderer | 13-14 | Zustand store, layout provider |
| 6. Hook | 15 | Claude Code hook installer |
| 7. UI | 16-23 | Panel, diff, banner, trash, settings, profile cleanup |
| 8. Finalize | 24 | Docs, README, flag removal |

**24 tasks, ~100 steps.** Each task produces a self-contained commit. Tests run with `pnpm vitest run --config vitest.config.node.mts`.

---

## Appendix: Items for the executing agent to fill in

The following spec requirements are **referenced but not fully coded** in this plan. The executing agent should implement them using the spec (§ references provided) and the patterns established by the tasks above:

- **Task 16 (VersionHistoryPanel)**: Full JSX for the panel. Follow spec §10.2 for row layout (timestamp, source label, pin toggle, action buttons, filter tabs). Reference `components/external-edit-banner.tsx` for styling patterns.
- **Task 19 (TrashSection)**: Full JSX for the collapsible section. Reference spec §10.5 for restore/permanent-delete actions. The data comes from `state.json`'s `ItemState.deletedAt` + `trashId` fields.
- **Integration tests** (spec §11): `app/api/version-history/__tests__/route.test.ts` and `app/api/rescan/__tests__/route.test.ts`. Follow the tmpdir pattern from `lib/__tests__/file-ops.test.ts`. Note: vitest.config.node.mts `include` covers `lib/**/*.test.ts` only — extend to include `app/api/**/__tests__/*.test.ts` if adding route tests.
- **Bootstrap lock** (spec §12 step 6): The rescan walker (`lib/external-rescan.ts`) already creates bootstrap snapshots idempotently (createSnapshot dedup prevents duplicates). A file-based lock (`bootstrap-{profileId}.lock`) should be added if concurrent bootstrap + user-write can race. For v1, the per-item mutex in `versioned-write.ts` serializes writes, which is sufficient.
