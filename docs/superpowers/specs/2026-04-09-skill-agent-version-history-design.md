# Skill / Agent Version History — Design Spec

**Date:** 2026-04-09
**Status:** Draft (awaiting user review)
**Owner:** harness-hub

## 1. Goal

Give users a reliable version history for Skills and Agents managed through harness-hub, so that:

- Every successful edit — whether from harness-hub, Claude Code, or any other tool — is captured as a snapshot.
- Users can browse past versions, compare any two versions via diff, and restore any version safely.
- Histories are scoped per profile (each `homePath` gets its own independent timeline).

The concrete user story that drove this work: "I asked Claude to modify a skill three times, the second attempt was the best, and I want to roll back to it."

## 2. Non-goals (v1)

- **Export / Import** of histories to files. All restore flows are fully in-app.
- **Export to git**, rich merge, branching, or cherry-picking.
- **Automatic garbage collection** by age or count. v1 keeps everything forever; a manual "Clean up" button is provided.
- **Real-time filesystem watcher** (`chokidar`). Detection relies on (a) the Claude Code hook, (b) launch rescan, (c) on-focus rescan. See §6.
- **History for plugin skills** (`source === "plugin"`). Plugin content is managed upstream and is read-only in harness-hub.
- **History for team-inbox agents** (`~/.claude/teams/.../inboxes/*.json`). Those are message logs, not definitions.
- **Mobile parity for diff view.** Mobile gets a simplified list-of-versions + restore; the split-diff UI is desktop only.

## 3. Scope

Covered surfaces:

| Kind | Path (inside `{homePath}`) | Scope filter |
|---|---|---|
| Skill | `skills/{name}/**` (whole folder tree) | `source === "custom"` only |
| Agent | `agents/{name}.md` (single file, treated as "1-file skill") | `scope === "user"` only |

Everything below applies uniformly to both — the data model treats an agent as a degenerate skill whose tree has exactly one file.

## 4. Prerequisite bug fix — Skills frontmatter round-trip

Before version history can be safely layered on, an existing bug in the skills edit path must be fixed. Without this, every snapshot taken after a harness-hub edit would encode the bug.

**Bug:** `app/api/skills/route.ts:36` returns `{ content: result.data.content, frontmatter: result.data.frontmatter }` — the parsed body without frontmatter. `app/skills/page.tsx:54-61` loads only `content` into the editor. On save, `PUT` at `:98` writes that body back as the whole file, **silently stripping any frontmatter that was on disk**.

**Fix:** Mirror the agents route pattern (`app/api/agents/route.ts:58`):

1. Skills `GET` must return `rawContent` (full bytes, frontmatter + body).
2. `app/skills/page.tsx` stores `rawContent` and passes it to `MarkdownViewer`.
3. `MarkdownViewer` already accepts `rawContent` + `onSave(rawContent)` (used by agents) — no component change needed, just pass the prop.
4. Skills `PUT` is unchanged — it already writes whatever content the caller sends.

This fix ships as the first commit of the version-history feature.

## 5. Architecture overview

### 5.1 Storage layout

All version data lives under `{userDataPath}/versions/{profileId}/`, where `{userDataPath}` is Electron's `app.getPath('userData')` — e.g. `~/Library/Application Support/harness-hub/` on macOS, `%APPDATA%/harness-hub/` on Windows.

```
{userDataPath}/versions/{profileId}/
├── state.json                    # live manifest: last-known hash/mtime per tracked file
├── homePath.txt                  # recorded homePath for drift detection
├── snapshots/
│   ├── skill/
│   │   └── {skillName}/
│   │       ├── {snapshotId}.json        # tree manifest: { "SKILL.md": "sha256:...", ... }
│   │       └── _deleted.json            # soft-delete marker (only present in trash)
│   └── agent/
│       └── {agentName}/
│           └── {snapshotId}.json
├── objects/
│   └── {first2}/{rest}.bin       # content-addressable blob (sha256)
└── objects-meta/
    └── {first2}/{rest}.json      # { firstSeenAt, originalPath } — forensic sidecar
```

**Why userData and not `{homePath}/.harness-hub-versions/`:**
- User deliberately picked userData over homePath-embedded storage because profiles are often created inside git repos and polluting `.gitignore` is undesirable.
- Known limitation (documented, not user-facing in production): running `pnpm dev` *and* the packaged app simultaneously against the same profile will fork the history into two independent userData locations. End users never do this; developers working on harness-hub itself will.

### 5.2 Data model

**`{profileId}/state.json`** — the live manifest:

```typescript
interface ProfileState {
  version: 1;
  profileId: string;
  homePath: string;              // resolved real path at last rescan
  files: Record<RelativeFilePath, FileState>;
  skills: Record<SkillName, ItemState>;   // per-item bookkeeping
  agents: Record<AgentName, ItemState>;
}

interface FileState {
  hash: string;                   // "sha256:..."
  size: number;
  mtimeMs: number;
  lastSeenAt: number;             // epoch ms
  source: "harness-hub" | "claude-hook" | "external";
}

interface ItemState {
  latestSnapshotId: string | null;
  // Aggregate source across all tracked files in this item. If ANY file is
  // currently "external" or "claude-hook", the item surfaces that source in
  // the UI (banner, list dot). Collapsed into one field so the banner has a
  // single authoritative source to read, avoiding per-file ambiguity.
  currentSource: "harness-hub" | "claude-hook" | "external" | "bootstrap";
  // Monotonic counter used by the External Edit banner to track which
  // snapshots the user has already dismissed in the current session.
  currentSourceSnapshotId: string | null;
  deletedAt: number | null;       // soft-delete timestamp, null if live
  trashId: string | null;         // opaque id used inside Trash
  pinnedSnapshotIds: string[];
}
```

**`snapshots/{kind}/{name}/{snapshotId}.json`** — an immutable tree snapshot:

```typescript
interface Snapshot {
  id: string;                     // ULID-ish, sortable by time
  kind: "skill" | "agent";
  itemName: string;
  createdAt: number;
  source: "harness-hub" | "claude-hook" | "external" | "bootstrap" | "restore";
  label?: string;                 // e.g. "Restored from v12", "External edit"
  sourceSnapshotId?: string;      // set when source === "restore"
  tree: Record<RelativeFilePath, string>;   // path → "sha256:..."
  // Integrity: every hash here must exist in objects/
}
```

**`snapshotId`**: ULID. Lexicographically sortable by time, collision-free, URL-safe. No dependency on an external ULID library — we can generate `{timestampBase32}{randomHex}` inline.

### 5.3 New / modified files

**New modules:**

| File | Responsibility |
|---|---|
| `lib/version-store.ts` | Low-level manifest + object store: `readState`, `writeState`, `putObject`, `getObject`, `hasObject`, `createSnapshot`, `listSnapshots`, `getSnapshot`, `deleteSnapshotTree`. Pure functions taking the base path as a parameter. |
| `lib/versioned-write.ts` | The single write path for skills/agents. Hash-based conflict detection, pre-write rescan, post-write snapshot, state.json update. |
| `lib/external-rescan.ts` | Walks a homePath tree, compares against state.json, creates "external" snapshots for drift, returns a report. |
| `lib/user-data-path.ts` | Tiny helper. In Next routes: reads `x-user-data-path` header set by the renderer. In Electron main: computes `app.getPath('userData')`. |
| `lib/claude-hook-installer.ts` | Idempotent install/uninstall of the harness-hub PostToolUse hook into `~/.claude/settings.json`. Deep merge, not overwrite. |
| `stores/version-history-store.ts` | Zustand store for UI state: currently-open history panel, selected snapshot, diff mode, trash view. Keyed by `(profileId, kind, name)`. Resets on `activeProfileId` change. |
| `app/api/version-history/route.ts` | `GET ?action=list|get|compare`, `POST action=restore|pin|unpin`, `DELETE action=purgeProfile`. |
| `app/api/trash/route.ts` | `GET` list trashed items, `POST action=restore`, `DELETE` permanent. |
| `app/api/rescan/route.ts` | `POST` — accepts optional `{ kind, name, filePath }` hint from the Claude Code hook, or no body for full-tree rescan. Returns snapshot deltas. |
| `components/version-history-panel.tsx` | Right-side panel: version list, pin toggle, selection, "Compare" / "Restore" actions. |
| `components/version-diff-view.tsx` | Wraps `react-diff-viewer-continued`. Split view, multi-file nav for skill snapshots. |
| `components/trash-section.tsx` | Collapsible "Deleted" section at the bottom of the Skills/Agents list. |
| `components/external-edit-banner.tsx` | Amber banner shown when the current item's state source is `external` and unacknowledged. |

**Modified files:**

| File | Change |
|---|---|
| `app/api/skills/route.ts` | GET returns `rawContent`. PUT/POST/DELETE route through `versioned-write`. |
| `app/api/agents/route.ts` | PUT/POST/DELETE route through `versioned-write`. |
| `app/skills/page.tsx` | Store `rawContent`; pass to `MarkdownViewer`. Wire history panel + trash section. Listen to profile change. |
| `app/agents/page.tsx` | Wire history panel + trash section. Listen to profile change. |
| `components/markdown-viewer.tsx` | Add an optional `history` slot prop (right-side) and an `externalEditBanner` slot prop (top). No editor rewrite. |
| `stores/app-settings-store.ts` | In `removeProfile`, call `/api/version-history?action=archiveProfile&id={id}` (best-effort fire-and-forget). |
| `lib/api-client.ts` | Add `x-profile-id` header alongside the existing `x-claude-home` on every request, so version-history API routes can correlate without re-deriving from store state. |
| `app/app-settings/page.tsx` | Add an "Archived histories" section that lists `state.archived-*.json` files (from homePath-change events, §9.3) and lets the user browse or purge them. Also host the "Clean up orphaned objects" button (runs mark-and-sweep, §7). |
| `app/layout.tsx` | Add a mount-time effect that waits for `getUserDataPath()` IPC to resolve, stores it in the version-history store, and then fires the initial `POST /api/rescan`. Also subscribes to `activeProfileId` changes and resets the version-history store. Single owner for the subscription — nowhere else. |
| `electron-src/main.ts` | Add `ipcMain.handle("version-store:base-path", ...)` and `mainWindow.on("focus", ...)` → `webContents.send("window:regain-focus")`. The `focus` listener must be (re)attached inside `createWindow()` so it survives the `app.on("activate")` re-creation path on macOS. |
| `electron-src/preload.ts` | Expose `getUserDataPath()` and `onWindowRegainFocus(cb)`. |
| `package.json` | Add `react-diff-viewer-continued` dependency. |

## 6. Detection mechanisms

A snapshot can be created by exactly four code paths. Each path routes through `createSnapshot` in `lib/version-store.ts`, which enforces the content-hash dedup rule (no-op if every file in the tree has the same hash as the latest snapshot).

### 6.1 harness-hub save (primary)

The user edits in `MarkdownViewer` and clicks Save. The request hits `skills.PUT` or `agents.PUT`, both of which delegate to `versioned-write.writeItem()`. Every call is serialized through a per-item in-process mutex (§7) so concurrent requests for the same item run strictly in order.

**Primary-file selection rule for skills.** harness-hub's editor only touches a single file per skill. That file is chosen deterministically:

1. If `SKILL.md` exists at the skill root, use it.
2. Otherwise, the alphabetically first `.md` file at the skill root.
3. If neither exists (new skill with no `.md` yet), create `SKILL.md`.

This replaces the current non-deterministic `files.find(f => f.endsWith(".md"))` in `app/api/skills/route.ts:94`. All other files inside the skill tree (references, scripts, assets) are **read by the rescan but never written by harness-hub itself** — they are external-edit territory.

**Write flow:**

1. Resolve absolute paths from `homePath` + `kind` + `name`.
2. Acquire the per-item mutex `(profileId, kind, name)`.
3. Read the current on-disk state of the *entire* item tree (single file for agents, whole folder for skills) and hash each file.
4. **Unified conflict detection.** Compare the computed tree hash against *both* (a) the `x-expected-tree-hash` header the client sent (what the client thinks the tree looked like when it loaded), and (b) `state.json.files`'s last-known hash (what harness-hub last wrote or last saw during rescan). Three outcomes:
    - Both match → no drift, proceed.
    - `state.json` disagrees → the disk drifted since our last observation (someone edited between rescans). Create an `"external"` snapshot first so the drift is preserved.
    - Client header disagrees but `state.json` agrees → the client is stale but we already saw the change. No extra snapshot; continue.
    - Both disagree → the disk drifted *and* the client is stale. Create an `"external"` snapshot and continue. The client sees the new state post-save via the response.
5. Write the primary file using the tmp-file + fsync + rename pattern (not the current bare `writeFile`). The implementation lives in `lib/version-store.ts`'s `writeWithFsync` helper, **not** `lib/file-ops.ts` — the existing `writeJsonFile` does not call `fsync` and we deliberately do not modify it to avoid changing the behavior of other callers.
6. Re-hash the tree (now reflecting step 5's write).
7. Call `createSnapshot({ source: "harness-hub", tree })`.
8. Update `state.json.files` entries with the new hashes and `source: "harness-hub"`. Update `ItemState.currentSource` to `"harness-hub"`.
9. fsync each write, tmp-rename `state.json` last.
10. Release mutex.

### 6.2 Claude Code hook (real-time external capture)

harness-hub installs a PostToolUse hook into `~/.claude/settings.json` using the officially documented schema:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "http",
            "url": "http://127.0.0.1:3000/api/rescan",
            "headers": {
              "x-harness-hub-hook": "1"
            }
          }
        ]
      }
    ]
  }
}
```

Why HTTP hook type (not Command):

- No shell, no jq, no cross-platform `bash`/`powershell` divergence.
- Claude Code POSTs the full hook payload (including `tool_input.file_path`) as the request body directly.
- Trivial install/uninstall — no `.sh`/`.ps1` files to drop on disk.

On receipt at `/api/rescan`:

1. Parse the payload. Extract `tool_input.file_path`.
2. If `file_path` is inside the active profile's `homePath/skills/` or `homePath/agents/`, resolve which `(kind, name)` it belongs to.
3. Run a *scoped* rescan on just that item (not the whole tree). If drift is found, create a snapshot with `source: "claude-hook"`.
4. Return a JSON summary. Claude Code does nothing with the response, but logs it on errors.

**Best-effort guarantee.** If harness-hub isn't running, the POST fails, Claude Code logs it, and no snapshot is made for that edit. The launch rescan (§6.3) catches it on next startup.

**Schema verification.** The `type: "http"` PostToolUse hook shape above was verified against the official Claude Code hooks documentation (hooks.md, hooks-guide.md) before this spec was finalized. Implementation must re-verify against the live docs at the moment of coding, because Claude Code is an active product — the check list in §15 carries this as a pre-implementation gate.

**Install flow.**

- On user opt-in toggle in App Settings → "Enable real-time capture for Claude Code edits", `lib/claude-hook-installer.ts` runs:
  1. Read `~/.claude/settings.json` (create if missing).
  2. Deep-merge the PostToolUse entry. **Merge rule: always append our entry as a *new matcher-level object* inside `hooks.PostToolUse`**, even if a matcher with the same regex (`Edit|Write`) already exists from the user's own configuration. Never mutate existing matcher entries — their hook order is user-authored and opaque to us.
  3. Detect our entry on subsequent runs by the exact `url` (`http://127.0.0.1:3000/api/rescan`) combined with the `x-harness-hub-hook: 1` header. Absence of this combination on re-install means we create a fresh entry; presence means we skip.
  4. Write back using `file-ops.writeJsonFile` (existing mtime check + backup).
- The toggle can also uninstall cleanly by removing *only* the matcher-level object whose `url` + header combo identifies us. Everything else in `hooks.PostToolUse` is untouched.
- The feature ships **opt-in** (user must flip the toggle). Hooks are privileged and users should consent. The toggle UI previews the exact JSON fragment that will be written to settings.json before the user confirms.

### 6.3 Launch rescan

On Electron `app.whenReady()` → first renderer mount, the renderer fires `POST /api/rescan` with no body (full-tree mode). The route walks `homePath/skills/*` and `homePath/agents/*.md`:

1. For each tracked item, compute the current tree hash.
2. Compare to `state.json.files`. If the `source` was `"harness-hub"` and the hash has changed, label the new snapshot `"external"`. If already `"external"`, it's drifted again — still `"external"`.
3. Detect deletions: items present in state.json but missing on disk → soft delete (Trash).
4. Detect renames (heuristic): if a state.json entry is missing from disk *and* a new on-disk item has a tree hash that matches the missing entry's last known hash, treat it as a rename. Move the item's snapshot history to the new name. No user confirmation in v1; log the heuristic decision.
5. Batch the results into a single `rescan-report` and persist snapshots.

### 6.4 On-focus rescan

`mainWindow.on('focus', ...)` → `webContents.send('window:regain-focus')` → renderer debounces (2 s) → fires `POST /api/rescan`.

- **Debounce**: 2 s window, trailing edge. Alt-Tab spam can't trigger multiple rescans.
- **Mutex**: a module-level `rescanInFlight` promise. Concurrent triggers coalesce into the in-flight run.

## 7. Data integrity & atomicity

- **Per-item in-process mutex.** `lib/versioned-write.ts` maintains a `Map<string, Promise<void>>` keyed by `"{profileId}:{kind}:{name}"`. Every write/restore/rescan touch to a given item is serialized through this mutex. Concurrent PUTs to the same skill/agent run strictly in order, preventing `state.json` last-write-wins loss. The mutex is process-local; distinct Next server processes would each have their own, which is acceptable because version data is also per-userData-path (§5.1). Rescan operations on *different* items run in parallel; only same-item is serialized.
- **Write order for every mutation**: object(s) → fsync → snapshot json → fsync → state.json → fsync. All via tmp-file + rename. Note that `lib/file-ops.ts`'s existing `writeJsonFile` helper does *not* call fsync — this spec deliberately does not change that helper to avoid affecting unrelated JSON writes across the app. Instead, `lib/version-store.ts` introduces a new `writeWithFsync(path, bytes, expectedMtime?)` helper and uses it exclusively for version-store mutations.
- **Boot integrity scan**: on first profile load, walk `state.json` and verify every referenced hash exists in `objects/`. If an object is missing, mark the containing snapshot as `{ corrupted: true }` in its JSON and hide it from the UI unless the user toggles "Show corrupted". If `state.json` itself references an item whose `latestSnapshotId` points to a snapshot file that cannot be parsed, the item is marked as needing recovery and a `recovery` snapshot is created on next write.
- **Orphan GC**: the manual "Clean up orphaned objects" button in App Settings runs mark-and-sweep. Walk every `snapshots/**/*.json`, collect referenced hashes, delete any object not in the set. Orphan sweep also prunes `objects-meta/` sidecars whose object was deleted.
- **Restore atomicity**:
  - *Single-file restore (agents)*: standard tmp + fsync + rename.
  - *Folder restore (skills)*: materialize the target tree into `{homePath}/skills/.{name}.restore-{snapshotId}.tmp/`, then directory-rename over the old folder. POSIX guarantees atomic directory rename on the same filesystem. On Windows (non-atomic directory rename), fall back to per-file write with a pre-restore auto-snapshot as the rollback point. If per-file write fails mid-way, `versioned-write` automatically attempts to restore the pre-restore snapshot once; if that secondary restore also fails, the item is flagged `needsRecovery: true` and the UI shows a persistent red banner with a manual "Restore from `{snapshotId}`" button.
  - In both cases, a `pre-restore` snapshot is created *before* the restore executes. That snapshot is the undo target.
  - **Restore semantics for added files.** The snapshot tree is authoritative. Files that exist on disk but are absent from the snapshot tree are **removed** by the restore (captured first in the pre-restore snapshot, so nothing is truly lost). This matches user expectation of "restore means return to that point in time".
- **Snapshot dedup**: `createSnapshot` computes the tree hash and compares to the previous snapshot of the same item. If identical, returns the previous snapshot id without writing anything new. State.json `lastSeenAt` is still bumped.

## 8. Path safety & allowlist

- **Extension allowlist** (tracked by rescan): `.md`, `.json`, `.txt`, `.py`, `.sh`, `.yaml`, `.yml`, `.toml`.
- **Always ignored**: `.DS_Store`, `*.swp`, `*~`, `#*#`, `.git/`, `node_modules/`, anything starting with `.` except explicitly allowed config.
- **Symlinks**: `fs.realpath` every candidate path. If the canonical target lies outside `homePath`, skip. BFS walker carries a visited `Set<realpath>` to prevent cycles.
- **Path segment validator**: shared with skills/agents routes. Reject if:
  - contains `..`, `/`, `\`, or NUL
  - is empty, `.`, `..`, or contains only dots
  - matches Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) case-insensitively
  - has leading/trailing whitespace

## 9. Profile handling

**`profileId` definition.** Throughout this spec, `profileId` is `Profile.id` from `stores/app-settings-store.ts` — either the literal string `"default"` for the built-in default profile, or `"profile-{timestamp}-{random}"` for user-created ones (`stores/app-settings-store.ts:121`). This value is stable across renames (only `name` and `homePath` change on rename, never `id`). The version store uses this as the directory key under `{userDataPath}/versions/{profileId}/`.

### 9.1 Profile switch — cache invalidation

- `stores/version-history-store.ts` exposes a `resetForProfile(newProfileId: string)` action. The subscription that drives it lives in exactly one place: `app/layout.tsx`'s mount effect, which calls `useAppSettingsStore.subscribe(state => state.activeProfileId, resetForProfile)`. No other component subscribes — putting the listener in a single high-level owner avoids duplicate fires.
- All SWR / data-fetching keys for version-history endpoints include the `profileId` as part of the key. Each fetcher is wrapped in an `AbortController` whose signal is aborted the instant `activeProfileId` changes, so stale responses never land in the store.
- API routes that touch version data read `x-claude-home` (already wired by `lib/api-client.ts`) **and** `x-profile-id` (newly added to `lib/api-client.ts`). The profileId is the authoritative key for version-store paths; `x-claude-home` continues to be used only for disk reads of the actual skill/agent files.

### 9.2 Profile delete — soft-archive, not purge

`useAppSettingsStore.removeProfile(id)` fires `DELETE /api/version-history?action=archiveProfile&id={id}` before removing from store state. **This is a soft-archive, not a purge** — the naming matters because the route never deletes bytes on the spot. It moves `{userDataPath}/versions/{id}/` into a sibling `versions/_archived/{timestamp}_{id}/` directory so the user can recover from an accidental delete.

An on-launch sweep prunes `_archived/*` older than 30 days. **v1 scope: the sweep runs but the 30-day threshold is configured in code only, no UI slider.** The "Clean up" button in App Settings can also permanently purge all archived profiles older than 7 days on manual invocation.

### 9.3 homePath change

If `state.json.homePath !== currentProfile.homePath` on load, the manifest is "frozen": `state.json` is renamed to `state.archived-{timestamp}.json`, and `snapshots/` is copied into `snapshots-archived-{timestamp}/`. A fresh empty `state.json` and `snapshots/` are then bootstrapped against the new homePath.

This is surfaced to the user as a toast: "History archived because profile path changed — view archived history in App Settings". The App Settings "Archived histories" section (added in §5.3's modified files list) lists all `state.archived-*.json` files for the current profile with timestamps, lets the user open any archived snapshot in a read-only diff viewer, and offers a "Permanently delete this archive" button. Archived state is never automatically merged into the live timeline.

## 10. UI

### 10.1 Desktop layout

`MarkdownViewer` itself is **not modified**. All new UI is added as sibling components to the existing `Panel` layout in `app/skills/page.tsx:262-284` and `app/agents/page.tsx:330-349`.

The current structure is:

```
Group (horizontal)
  Panel(list, 28%)
  Panel(detail, 72%)  ← contains <MarkdownViewer>
```

After the change, the detail Panel's inner content wraps itself in a nested `Group`:

```
Group (horizontal, outer)
  Panel(list, 28%)
  Panel(detail-outer, 72%)
    Group (horizontal, inner) — only rendered when History panel is open
      Panel(editor-area, 70%)
        <ExternalEditBanner />  ← conditional, at top of this Panel
        <MarkdownViewer ... />   ← unchanged
      Panel(history-area, 30%)
        <VersionHistoryPanel ... />
```

When the History panel is closed (default), the inner Group collapses back to rendering just the editor area — no nested Group at all — so the layout is identical to today's behavior for users who never open history.

A **History** button is added to the existing editor toolbar area (the `MarkdownViewer` already has a toolbar slot with Preview/Raw/Edit buttons — the History button lives next to them, placed by the page wrapper rather than by the viewer internally). The button toggles `isHistoryOpen` in `version-history-store`.

This approach:

- Makes zero changes to `MarkdownViewer`'s props or internals.
- Keeps the History panel responsible for its own render/state, not the viewer.
- Works naturally with `react-resizable-panels` nested groups (officially supported).
- Leaves the mobile stacked path (`app/skills/page.tsx:240-258`) completely alone until §10.7's mobile navigation kicks in.

### 10.2 Version history panel

| Row component | Content |
|---|---|
| Header | `{itemName}` + "Close" button |
| Current state chip | `⚠ External edit · 2 min ago` when applicable, else `● Live` |
| Filter toggles | `All` / `Pinned` / `By Claude` / `By me` / `External` |
| Version list | Chronological descending, one row per snapshot: `[⭐]  {localDateTime} · {sourceLabel} · {filesChangedCount} files` |
| Selection actions | `Preview` (inline) / `Compare with current` / `Compare with…` / `Restore` |

Multi-select (shift-click two rows) opens the diff view directly.

### 10.3 External edit banner

Rendered when `state.files[*].source === "external"` and the user has not dismissed it for that snapshotId:

```
⚠ This file was modified outside harness-hub  ·  2026-04-09 14:32  ·  by claude-hook
   [View changes]  [Revert to previous]  [Dismiss]
```

- `View changes` opens the history panel and pre-selects the external snapshot vs its predecessor.
- `Revert to previous` runs a restore to the last `source: "harness-hub"` snapshot.
- `Dismiss` records the ack in renderer state (not persisted — reappears on next session if still external).

### 10.4 Diff view

`react-diff-viewer-continued`, split mode by default, monospace, wrapping off. For skill snapshots with multiple changed files, a left-rail file list selects which file's diff renders on the right. Unchanged files are collapsed behind a "Show N unchanged files" disclosure.

**Performance guards:**

- If a snapshot's `tree` has more than 50 files, the diff view renders a warning banner ("Large skill tree — diff will render on demand") and loads file diffs lazily as the user clicks into them, rather than eagerly rendering all of them on open.
- If a single file diff exceeds 2000 lines, the view falls back to unified mode and collapses runs of unchanged context to 3 lines.

### 10.5 Trash section

Appended to the bottom of the Skills list and the Agents list, collapsible, titled `Deleted (N)`. Each row shows the item name and deletion timestamp. Actions:

- **Restore**: materializes the latest snapshot back to disk. If the name is currently in use, prompts for a new name.
- **Delete permanently**: purges all snapshots and objects uniquely referenced by this item (not a global GC — bounded sweep).

### 10.6 Pin

A ⭐ toggle on each version row. Pinned versions show in the `Pinned` filter and are never touched by future GC. v1 has no GC, so Pin is UI-only today; the data structure is in place for v2.

### 10.7 Mobile layout

Detail view gains a `History` button. Clicking it navigates into a nested mobile view (list → detail → history) with a standard "Back to detail" button at the top. The history view is a plain vertical list. Restoring is supported. Diff view on mobile is limited to a single-file unified diff — no split view, no multi-file nav.

## 11. Testing strategy

Pattern: follow `lib/__tests__/file-ops.test.ts` — tmpdir per test, clean up in `afterEach`.

**Unit tests** (vitest, `vitest.config.node.mts`):

- `lib/version-store.test.ts` — object store put/get, snapshot create/dedup, state.json round-trip, corruption detection.
- `lib/versioned-write.test.ts` — harness-hub write creates snapshot; pre-existing external drift creates two snapshots (external then harness-hub); fsync order simulation via injected fs mock.
- `lib/external-rescan.test.ts` — new item detected as bootstrap; modified item as external; deleted item as soft-delete; renamed item heuristic; symlink cycle rejected; blacklisted files ignored.
- `lib/claude-hook-installer.test.ts` — install into empty settings.json; merge with existing hooks; uninstall leaves unrelated hooks untouched; malformed JSON is preserved with an error (not rewritten).
- `lib/path-validator.test.ts` — all reject cases from §8.

**Integration tests** (also node env):

- `app/api/version-history/__tests__/route.test.ts` — list/get/restore against a real tmpdir.
- `app/api/rescan/__tests__/route.test.ts` — scoped rescan triggered by a simulated Claude hook payload.

**Out of scope for v1 tests:**

- End-to-end Electron IPC tests (no existing harness).
- UI snapshot tests for the diff view.

## 12. Rollout

1. **Skills frontmatter fix** (§4) as its own commit. No feature flag — this is a bug fix that ships standalone.
2. **Electron IPC + preload** changes. `ipcMain.handle("version-store:base-path", ...)`, `mainWindow.on("focus", ...)`, preload exposure. Without this, step 4 cannot wire `x-user-data-path` into API calls. Must come before any version-store code that runs in the renderer → API path.
3. **`lib/version-store.ts`** + unit tests, in isolation. Pure functions taking `basePath` as a parameter — testable without any IPC or routes.
4. **`lib/versioned-write.ts`** + unit tests + wire into skills/agents PUT routes. Feature flag: `HARNESS_HUB_VERSION_HISTORY=1` env var gates the snapshot side-effects. When off, `versioned-write` becomes a passthrough to the existing bare `writeFile`. Default on once tests pass.
5. **`lib/external-rescan.ts`** + `/api/rescan` route + launch-rescan trigger in `app/layout.tsx` mount effect.
6. **Bootstrap job**: on first load with the feature flag on, create a `source: "bootstrap"` snapshot for every existing skill and agent. **Bootstrap is gated by a global per-profile lock** (`bootstrap-{profileId}.lock` file in the version store, removed on completion). Writes via `versioned-write` that arrive during bootstrap acquire the same lock before proceeding, so a save during bootstrap is serialized after it. Idempotent — `createSnapshot`'s dedup means re-running bootstrap is a no-op.
7. **`lib/claude-hook-installer.ts`** + App Settings toggle. Default **off**; the toggle explains what gets written to `~/.claude/settings.json` and shows a preview of the exact JSON fragment before applying.
8. **UI**: `VersionHistoryPanel`, `VersionDiffView`, `ExternalEditBanner`, `TrashSection`, "Archived histories" section in App Settings, "Clean up orphaned objects" button. Feature flag controls visibility of the History button.
9. **Flip feature flag default to on.** Write `docs/features/version-history.md` per the project's CLAUDE.md HARD GATE and update the README features table.

## 13. Open questions (accepted, documented for future)

- **Real-time watcher as a fallback for non-Claude edits.** If post-ship telemetry shows users still losing vim/direct-edit history, add `chokidar` as an opt-in "paranoid mode".
- **SQLite backing store for state.json.** v1 uses a single JSON file rewritten per mutation. Acceptable for a few hundred files per profile. If manifests grow into the MB range, migrate to `better-sqlite3`.
- **Cross-machine history sync.** v1 deliberately skipped Export/Import. A future version may ship a `harness-hub history export --profile={id} --out={dir}` CLI that bundles `versions/{id}/` as a tarball.
- **History for plugin-provided skills** (if users ever fork one into custom scope with a "Fork to custom" action).
- **Merge across homePath changes.** Currently archives on change; a future version may offer a UI flow to rebase archived history onto the new homePath.

## 14. Known limitations (documented, not user-facing in production)

- Running `pnpm dev` and the packaged app simultaneously against the same `~/.claude/` will produce two disjoint histories (different `userData` paths). This is a **developer-only concern**; end users ship the packaged app.
- `pnpm dev` accessed through a regular browser (not Electron) has no IPC → no `x-user-data-path` header → version-history API routes return 503 Service Unavailable with a clear error. The Skills/Agents pages themselves continue to work; only the history panel is disabled. Also a **developer-only concern**.
- Windows folder-restore is non-atomic; it uses per-file writes behind a pre-restore snapshot.
- mtime resolution on FAT32 / some network filesystems is coarse (2 s) — the content-hash check is still authoritative, so this only affects the fast-path dedup, not correctness.
- Full-tree rescan on a profile with hundreds of files may take hundreds of ms on launch and each window focus. v1 runs this on the Next server thread synchronously; if it becomes noticeable, v2 moves rescan into a `worker_threads` Worker.

## 15. Pre-implementation checklist

These items must be verified *at the moment of implementation*, not relied on solely from this spec (because they depend on external state that can drift):

- [ ] Re-verify Claude Code PostToolUse `type: "http"` hook schema against the current official docs (`hooks.md`, `hooks-guide.md`). Confirm `headers` field is supported and that the payload body format matches what `/api/rescan` expects.
- [ ] Confirm `react-diff-viewer-continued` is still maintained and compatible with React 19 (harness-hub is on `react@19.2.4`).
- [ ] Confirm `react-resizable-panels` supports nested `Group` rendering (v4.9.0 is in the repo; docs currently say yes).
- [ ] Run `lib/file-ops.ts`'s test suite to confirm no regression after we add `writeWithFsync` as a parallel helper.
- [ ] Check that `electron-src/main.ts`'s `createWindow()` is the single entry point for `BrowserWindow` creation (it is, per current code) — required for the focus listener to survive `app.on("activate")` re-creation.

---

**End of spec.** Ready for user review.
