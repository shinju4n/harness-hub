# Embedded Terminal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bottom-docked, toggleable terminal panel to the Harness Hub Electron app so users can run shell commands (including `claude` CLI) without leaving the GUI. Working directory is auto-resolved from the current page.

**Architecture:**
- Main process owns PTY processes via `node-pty`. A `TerminalManager` class tracks sessions by id, exposes create/write/resize/kill, and forwards stdout to the renderer over IPC.
- Preload script bridges a minimal `window.electronTerminal` API. Renderer never touches Node directly.
- Renderer: a `TerminalDock` React component mounts `xterm.js` and subscribes to a Zustand `terminalStore` for open/closed state. The working directory is resolved from `usePathname()` **once at the moment the dock mounts** and frozen for the session's lifetime — navigating to other pages does NOT restart the PTY or change its cwd.
- Layout: `app/layout.tsx` renders a `LayoutShell` client component that uses a vertical `PanelGroup` (existing `react-resizable-panels` dep) when the dock is open and a plain container when it's closed. `app/layout.tsx` itself stays a server component so the `metadata` export is still valid.
- Hotkey: global `Cmd+\`` (mac) / `Ctrl+\`` (win/linux) toggles the dock via the store.

**Tech Stack:**
- `node-pty` (native PTY, requires Electron rebuild)
- `@xterm/xterm` + `@xterm/addon-fit` (terminal renderer)
- Existing: Electron 41, Next.js 16, React 19, Zustand 5, react-resizable-panels 4, Tailwind v4

**Out of scope (explicit non-goals):**
- Multiple tabs (single terminal MVP)
- Search/scrollback addons beyond xterm defaults
- Agent-aware features (auto-context injection, GUI auto-refresh on file edits) — explicitly rejected by Devil's Advocate review
- Windows-specific PTY tuning beyond `node-pty` defaults

---

## File Structure

**Create:**
- `electron-src/terminal-manager.ts` — TerminalManager class, PTY lifecycle. ~150 lines.
- `electron-src/__tests__/terminal-manager.test.ts` — unit tests with injected pty factory.
- `lib/page-cwd.ts` — pure function `resolvePageCwd(pathname, override?) → absolute path`. ~40 lines.
- `lib/__tests__/page-cwd.test.ts` — unit tests, all pathname → cwd cases.
- `stores/terminal-store.ts` — Zustand store: `isOpen`, `toggle()`, `setOpen()`. ~25 lines.
- `components/terminal-dock.tsx` — Client component, mounts xterm, wires IPC. ~180 lines.
- `components/terminal-dock-wrapper.tsx` — Lazy-loads dock client component (xterm is browser-only). ~20 lines.
- `components/use-terminal-hotkey.tsx` — Client hook + null-render component for global hotkey listener. ~30 lines.
- `types/electron-terminal.d.ts` — Ambient `window.electronTerminal` type declarations.
- `docs/features/terminal.md` — HARD GATE: feature documentation.

**Modify:**
- `electron-src/preload.ts` — expose `electronTerminal` via `contextBridge`.
- `electron-src/main.ts` — wire `TerminalManager` IPC handlers in `app.whenReady`.
- `app/layout.tsx` — mount `LayoutShell` + `TerminalHotkey`; keep it a server component so `metadata` export still works.
- `package.json` — add deps + `electron-builder install-app-deps` postinstall.
- `electron-builder.yml` — verify `node_modules/**/*` asarUnpack covers `node-pty` natives (already present per recon, but verified at packaged-build smoke test).
- `README.md` — HARD GATE: add Terminal row to Features table.

---

## Task 1: Add dependencies and verify native build

**Files:**
- Modify: `package.json`
- Modify: `electron-builder.yml` (verify only)

- [ ] **Step 1: Inspect existing electron-builder asarUnpack**

Run: `cat electron-builder.yml | head -20`
Expected: confirm `asarUnpack` already contains `node_modules/**/*`. If yes, no change needed for native module unpacking.

- [ ] **Step 2: Add runtime dependencies**

Run:
```bash
pnpm add node-pty @xterm/xterm @xterm/addon-fit
```

These must be in `dependencies` (not devDependencies) so they ship in the packaged app.

- [ ] **Step 3: Add electron rebuild for native module**

The current `package.json` has no `postinstall` script — add one:

```json
"scripts": {
  "postinstall": "electron-builder install-app-deps"
}
```

Then run:
```bash
pnpm install
```

Expected: `node-pty` rebuilds against Electron 41's Node ABI without errors. On macOS this should "just work"; on Windows it requires VS Build Tools but the GitHub Actions `windows-latest` runner ships with them.

- [ ] **Step 4: Verify electron:dev still boots**

Run: `pnpm electron:dev`
Expected: app window opens, no native module errors in console. Close the app.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(terminal): add node-pty and xterm dependencies"
```

---

## Task 2: Page → working directory resolver (TDD, pure function)

**Files:**
- Create: `lib/page-cwd.ts`
- Test: `lib/__tests__/page-cwd.test.ts`

This is the safest place to start because it's a pure function with no Electron or React dependencies.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/page-cwd.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import os from "os";
import path from "path";
import { resolvePageCwd } from "../page-cwd";

const HOME = os.homedir();
const CLAUDE = path.join(HOME, ".claude");

describe("resolvePageCwd", () => {
  it("returns ~/.claude/hooks for /hooks page", () => {
    expect(resolvePageCwd("/hooks")).toBe(path.join(CLAUDE, "hooks"));
  });

  it("returns ~/.claude/skills for /skills page", () => {
    expect(resolvePageCwd("/skills")).toBe(path.join(CLAUDE, "skills"));
  });

  it("returns ~/.claude/commands for /commands page", () => {
    expect(resolvePageCwd("/commands")).toBe(path.join(CLAUDE, "commands"));
  });

  it("returns ~/.claude/agents for /agents page", () => {
    expect(resolvePageCwd("/agents")).toBe(path.join(CLAUDE, "agents"));
  });

  it("returns ~/.claude/plugins for /plugins page", () => {
    expect(resolvePageCwd("/plugins")).toBe(path.join(CLAUDE, "plugins"));
  });

  it("returns ~/.claude for unknown pages", () => {
    expect(resolvePageCwd("/some-unknown-page")).toBe(CLAUDE);
  });

  it("returns ~/.claude for the dashboard /", () => {
    expect(resolvePageCwd("/")).toBe(CLAUDE);
  });

  it("matches nested routes by prefix (/hooks/foo → hooks)", () => {
    expect(resolvePageCwd("/hooks/some-script")).toBe(path.join(CLAUDE, "hooks"));
  });

  it("override takes precedence over pathname mapping", () => {
    expect(
      resolvePageCwd("/hooks", "/Users/me/projects/foo"),
    ).toBe("/Users/me/projects/foo");
  });

  it("override is ignored when null/undefined", () => {
    expect(resolvePageCwd("/hooks", null)).toBe(path.join(CLAUDE, "hooks"));
    expect(resolvePageCwd("/hooks", undefined)).toBe(path.join(CLAUDE, "hooks"));
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `pnpm vitest run --config vitest.config.node.mts lib/__tests__/page-cwd.test.ts`
Expected: FAIL — `Cannot find module '../page-cwd'`.

- [ ] **Step 3: Implement the resolver**

Create `lib/page-cwd.ts`:

```typescript
import os from "os";
import path from "path";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");

// Pages whose first path segment maps directly to a ~/.claude/<segment> directory.
const DIRECT_MAPPINGS = new Set([
  "hooks",
  "skills",
  "commands",
  "agents",
  "plugins",
  "mcp",
  "rules",
  "memory",
]);

/**
 * Resolves the working directory for a terminal opened from a given page.
 *
 * Resolution order:
 * 1. Explicit override (e.g. session cwd, plan cwd) — wins.
 * 2. First path segment matched against DIRECT_MAPPINGS → ~/.claude/<segment>.
 * 3. Fallback → ~/.claude.
 */
export function resolvePageCwd(
  pathname: string,
  override?: string | null,
): string {
  if (override) return override;

  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (firstSegment && DIRECT_MAPPINGS.has(firstSegment)) {
    return path.join(CLAUDE_DIR, firstSegment);
  }

  return CLAUDE_DIR;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm vitest run --config vitest.config.node.mts lib/__tests__/page-cwd.test.ts`
Expected: PASS, all 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/page-cwd.ts lib/__tests__/page-cwd.test.ts
git commit -m "feat(terminal): add page-cwd resolver with tests"
```

---

## Task 3: Terminal manager in Electron main process (TDD via injection)

**Files:**
- Create: `electron-src/terminal-manager.ts`
- Test: `electron-src/__tests__/terminal-manager.test.ts`

Use dependency injection so tests don't need a real PTY.

- [ ] **Step 1: Write the failing tests**

Create `electron-src/__tests__/terminal-manager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TerminalManager, type PtyLike, type PtyFactory } from "../terminal-manager";

function makeMockPty(): PtyLike & {
  _emit: (event: "data" | "exit", payload: unknown) => void;
} {
  const handlers: Record<string, ((p: unknown) => void)[]> = {};
  return {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: (cb) => {
      (handlers["data"] ||= []).push(cb as (p: unknown) => void);
      return { dispose: () => {} };
    },
    onExit: (cb) => {
      (handlers["exit"] ||= []).push(cb as (p: unknown) => void);
      return { dispose: () => {} };
    },
    _emit: (event, payload) => {
      (handlers[event] || []).forEach((h) => h(payload));
    },
  };
}

describe("TerminalManager", () => {
  let mockPty: ReturnType<typeof makeMockPty>;
  let factory: PtyFactory;
  let manager: TerminalManager;
  let dataEvents: { id: string; data: string }[];
  let exitEvents: { id: string; code: number }[];

  beforeEach(() => {
    mockPty = makeMockPty();
    factory = vi.fn(() => mockPty);
    dataEvents = [];
    exitEvents = [];
    manager = new TerminalManager({
      ptyFactory: factory,
      onData: (id, data) => dataEvents.push({ id, data }),
      onExit: (id, code) => exitEvents.push({ id, code }),
    });
  });

  it("creates a pty session and returns its id", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: "/tmp", cols: 80, rows: 24 }),
    );
  });

  it("returns distinct ids for each session", () => {
    const id1 = manager.create({ cwd: "/a", cols: 80, rows: 24 });
    (factory as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeMockPty());
    const id2 = manager.create({ cwd: "/b", cols: 80, rows: 24 });
    expect(id1).not.toBe(id2);
  });

  it("forwards data events to the onData callback", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    mockPty._emit("data", "hello");
    expect(dataEvents).toEqual([{ id, data: "hello" }]);
  });

  it("forwards exit events to the onExit callback", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    mockPty._emit("exit", { exitCode: 0 });
    expect(exitEvents).toEqual([{ id, code: 0 }]);
  });

  it("auto-cleans session on exit (subsequent write is no-op)", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    mockPty._emit("exit", { exitCode: 0 });
    manager.write(id, "ls\n");
    // Only the write calls BEFORE exit should reach the pty. Here we made none,
    // so the mock should never have been called with "ls\n".
    expect(mockPty.write).not.toHaveBeenCalled();
  });

  it("write() forwards to the underlying pty", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    manager.write(id, "ls\n");
    expect(mockPty.write).toHaveBeenCalledWith("ls\n");
  });

  it("resize() forwards cols/rows to the underlying pty", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    manager.resize(id, 100, 30);
    expect(mockPty.resize).toHaveBeenCalledWith(100, 30);
  });

  it("kill() removes the session and calls pty.kill", () => {
    const id = manager.create({ cwd: "/tmp", cols: 80, rows: 24 });
    manager.kill(id);
    expect(mockPty.kill).toHaveBeenCalled();
    // Subsequent write should be a no-op (no throw)
    expect(() => manager.write(id, "x")).not.toThrow();
  });

  it("write/resize/kill on unknown id are no-ops", () => {
    expect(() => manager.write("ghost", "x")).not.toThrow();
    expect(() => manager.resize("ghost", 80, 24)).not.toThrow();
    expect(() => manager.kill("ghost")).not.toThrow();
  });

  it("killAll closes every session", () => {
    const id1 = manager.create({ cwd: "/a", cols: 80, rows: 24 });
    const mockPty2 = makeMockPty();
    (factory as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockPty2);
    const id2 = manager.create({ cwd: "/b", cols: 80, rows: 24 });
    manager.killAll();
    expect(mockPty.kill).toHaveBeenCalled();
    expect(mockPty2.kill).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `pnpm vitest run --config vitest.config.node.mts electron-src/__tests__/terminal-manager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement TerminalManager**

Create `electron-src/terminal-manager.ts`:

```typescript
import { randomUUID } from "crypto";

export interface PtyLike {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(cb: (data: string) => void): { dispose(): void };
  onExit(cb: (e: { exitCode: number }) => void): { dispose(): void };
}

export interface PtyOptions {
  cwd: string;
  cols: number;
  rows: number;
}

export type PtyFactory = (options: PtyOptions) => PtyLike;

export interface TerminalManagerOptions {
  ptyFactory: PtyFactory;
  onData: (id: string, data: string) => void;
  onExit: (id: string, code: number) => void;
}

interface Session {
  pty: PtyLike;
}

export class TerminalManager {
  private sessions = new Map<string, Session>();

  constructor(private opts: TerminalManagerOptions) {}

  create(options: PtyOptions): string {
    const id = randomUUID();
    const pty = this.opts.ptyFactory(options);
    pty.onData((data) => this.opts.onData(id, data));
    pty.onExit((e) => {
      this.opts.onExit(id, e.exitCode);
      this.sessions.delete(id);
    });
    this.sessions.set(id, { pty });
    return id;
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.pty.resize(cols, rows);
  }

  kill(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.pty.kill();
    this.sessions.delete(id);
  }

  killAll(): void {
    for (const [, session] of this.sessions) {
      session.pty.kill();
    }
    this.sessions.clear();
  }
}

/**
 * Default factory that uses real node-pty. Lazy-imported so tests can avoid
 * loading the native module.
 *
 * Platform notes:
 * - We branch on `process.platform` FIRST. Git Bash for Windows can set
 *   `SHELL=/usr/bin/bash`, which would fail to spawn on native Windows.
 * - Windows default is `powershell.exe` (PS 5.1, shipped with every Windows).
 *   We intentionally do NOT read `COMSPEC` — on Windows that env var is almost
 *   always `cmd.exe`, and defaulting to cmd.exe would be a worse UX than
 *   PowerShell. Users who prefer pwsh/cmd can set `HARNESS_HUB_SHELL` in their
 *   environment (checked first on all platforms).
 * - We do NOT pass `useConpty`. Recent node-pty auto-selects ConPTY on
 *   supported Windows and falls back to winpty on older systems.
 */
export function createDefaultPtyFactory(): PtyFactory {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pty = require("node-pty");
  return (options: PtyOptions): PtyLike => {
    const override = process.env.HARNESS_HUB_SHELL;
    const shell = override
      ? override
      : process.platform === "win32"
        ? "powershell.exe"
        : (process.env.SHELL || "/bin/zsh");
    return pty.spawn(shell, [], {
      name: "xterm-256color",
      cwd: options.cwd,
      cols: options.cols,
      rows: options.rows,
      env: process.env as { [key: string]: string },
    });
  };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm vitest run --config vitest.config.node.mts electron-src/__tests__/terminal-manager.test.ts`
Expected: PASS, all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add electron-src/terminal-manager.ts electron-src/__tests__/terminal-manager.test.ts
git commit -m "feat(terminal): add TerminalManager with injected pty factory"
```

---

## Task 4: IPC handlers and preload bridge

**Files:**
- Modify: `electron-src/main.ts`
- Modify: `electron-src/preload.ts`
- Create: `types/electron-terminal.d.ts`

- [ ] **Step 1: Wire IPC handlers in main.ts**

Modify `electron-src/main.ts`:

Add imports near the top:
```typescript
import { ipcMain } from "electron";
import { TerminalManager, createDefaultPtyFactory } from "./terminal-manager";
```

Add a module-level reference:
```typescript
let terminalManager: TerminalManager | null = null;
```

Inside `app.whenReady().then(async () => { ... })`, after `createWindow();`, register:

```typescript
terminalManager = new TerminalManager({
  ptyFactory: createDefaultPtyFactory(),
  onData: (id, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("terminal:data", { id, data });
    }
  },
  onExit: (id, code) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("terminal:exit", { id, code });
    }
  },
});

ipcMain.handle("terminal:create", (_e, options: { cwd: string; cols: number; rows: number }) => {
  return terminalManager!.create(options);
});
ipcMain.on("terminal:write", (_e, payload: { id: string; data: string }) => {
  terminalManager?.write(payload.id, payload.data);
});
ipcMain.on("terminal:resize", (_e, payload: { id: string; cols: number; rows: number }) => {
  terminalManager?.resize(payload.id, payload.cols, payload.rows);
});
ipcMain.on("terminal:kill", (_e, payload: { id: string }) => {
  terminalManager?.kill(payload.id);
});
```

In `app.on("before-quit", ...)` add:
```typescript
terminalManager?.killAll();
```

- [ ] **Step 2: Expose API in preload.ts**

Replace `electron-src/preload.ts` content:

```typescript
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronTerminal", {
  create: (options: { cwd: string; cols: number; rows: number }): Promise<string> =>
    ipcRenderer.invoke("terminal:create", options),

  write: (id: string, data: string): void => {
    ipcRenderer.send("terminal:write", { id, data });
  },

  resize: (id: string, cols: number, rows: number): void => {
    ipcRenderer.send("terminal:resize", { id, cols, rows });
  },

  kill: (id: string): void => {
    ipcRenderer.send("terminal:kill", { id });
  },

  onData: (cb: (id: string, data: string) => void): (() => void) => {
    const handler = (_e: unknown, payload: { id: string; data: string }) =>
      cb(payload.id, payload.data);
    ipcRenderer.on("terminal:data", handler);
    return () => ipcRenderer.removeListener("terminal:data", handler);
  },

  onExit: (cb: (id: string, code: number) => void): (() => void) => {
    const handler = (_e: unknown, payload: { id: string; code: number }) =>
      cb(payload.id, payload.code);
    ipcRenderer.on("terminal:exit", handler);
    return () => ipcRenderer.removeListener("terminal:exit", handler);
  },
});
```

- [ ] **Step 3: Add ambient TypeScript declarations**

Create `types/electron-terminal.d.ts`:

```typescript
export interface ElectronTerminalAPI {
  create(options: { cwd: string; cols: number; rows: number }): Promise<string>;
  write(id: string, data: string): void;
  resize(id: string, cols: number, rows: number): void;
  kill(id: string): void;
  onData(cb: (id: string, data: string) => void): () => void;
  onExit(cb: (id: string, code: number) => void): () => void;
}

declare global {
  interface Window {
    electronTerminal?: ElectronTerminalAPI;
  }
}

export {};
```

Then verify `tsconfig.json` includes `types/**/*.d.ts` in its `include` array. If not, add it. (Run `cat tsconfig.json` first to check.)

- [ ] **Step 4: Verify electron compiles**

Run: `pnpm tsc -p tsconfig.electron.json --noEmit`
Expected: no errors.

Run: `pnpm tsc --noEmit` (full project type-check)
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add electron-src/main.ts electron-src/preload.ts types/electron-terminal.d.ts tsconfig.json
git commit -m "feat(terminal): wire IPC bridge between main and renderer"
```

---

## Task 5: Zustand terminal store

**Files:**
- Create: `stores/terminal-store.ts`

- [ ] **Step 1: Implement the store**

Create `stores/terminal-store.ts`:

```typescript
import { create } from "zustand";

interface TerminalState {
  isOpen: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  isOpen: false,
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
}));
```

Note: deliberately NOT persisted. Terminal state should reset between app launches.
No `cwdOverride` field: the terminal's cwd is resolved from the pathname at the moment the user *opens* the terminal, then frozen for that session's lifetime. See Task 6 for the rationale.

- [ ] **Step 2: Commit**

```bash
git add stores/terminal-store.ts
git commit -m "feat(terminal): add terminal-store"
```

---

## Task 6: TerminalDock React component

**Files:**
- Create: `components/terminal-dock.tsx`
- Create: `components/terminal-dock-wrapper.tsx`

**Design rationale (important):**
- The PTY is created **once** when the dock first mounts and persists across sidebar navigation. Changing the page does NOT kill the shell — this matches VS Code's behavior and avoids destroying any in-flight `claude`, `npm install`, or long-running process.
- The working directory is captured **at open time** by calling `resolvePageCwd(pathname)` once. If the user wants a terminal in a different directory, they close the dock (terminating the PTY) and reopen it from the new page. This is a deliberate MVP simplification.
- IPC data/exit listeners are attached **synchronously before** `api.create()` resolves. Since this is a single-terminal MVP, we don't need to filter by session id — whatever PTY exists is the one we're rendering. This removes the listener-leak race the earlier draft had.
- We use `ResizeObserver` on the container element, not `window.resize`. The `react-resizable-panels` handle drag resizes the container but does NOT fire `window.resize`, so xterm would otherwise not re-fit when the user drags the panel boundary.

- [ ] **Step 1: Implement the dock component**

Create `components/terminal-dock.tsx`:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useTerminalStore } from "@/stores/terminal-store";
import { resolvePageCwd } from "@/lib/page-cwd";

export function TerminalDock() {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  // Capture the cwd once at first mount — frozen for this session's lifetime.
  const [sessionCwd] = useState(() => resolvePageCwd(pathname));

  useEffect(() => {
    if (!containerRef.current) return;
    const api = window.electronTerminal;
    if (!api) {
      containerRef.current.innerHTML =
        '<div class="p-4 text-sm text-gray-500">Terminal is only available in the Electron app.</div>';
      return;
    }

    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", monospace',
      fontSize: 13,
      theme: {
        background: "#0a0a0a",
        foreground: "#e5e5e5",
        cursor: "#f59e0b", // amber-500
      },
      cursorBlink: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    // Attach listeners BEFORE create(). Single-terminal MVP, so no id filter
    // is needed — whatever session exists is this one.
    let activeId: string | null = null;
    let disposed = false;

    const unsubData = api.onData((_id, data) => term.write(data));
    const unsubExit = api.onExit(() => {
      term.write("\r\n\x1b[33m[process exited]\x1b[0m\r\n");
      activeId = null;
    });

    api
      .create({ cwd: sessionCwd, cols: term.cols, rows: term.rows })
      .then((id) => {
        if (disposed) {
          api.kill(id);
          return;
        }
        activeId = id;
        term.onData((data) => {
          if (activeId) api.write(activeId, data);
        });
        term.onResize(({ cols, rows }) => {
          if (activeId) api.resize(activeId, cols, rows);
        });
      })
      .catch((err) => {
        term.write(`\r\n\x1b[31mFailed to start terminal: ${err.message}\x1b[0m\r\n`);
      });

    // Use ResizeObserver so panel drag resizes refit xterm (window.resize does not fire).
    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // fit() can throw during unmount — ignore.
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      unsubData();
      unsubExit();
      if (activeId) api.kill(activeId);
      activeId = null;
      term.dispose();
    };
    // Empty deps: we want this effect to run exactly once per mount. Pathname
    // changes must NOT recreate the PTY.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-3 py-1 text-xs text-gray-400">
        <span>Terminal · {sessionCwd}</span>
        <button
          onClick={() => useTerminalStore.getState().setOpen(false)}
          className="rounded px-2 py-0.5 hover:bg-gray-800"
          aria-label="Close terminal"
        >
          ×
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden p-2" />
    </div>
  );
}
```

- [ ] **Step 2: Implement the dynamic wrapper**

Create `components/terminal-dock-wrapper.tsx`:

```typescript
"use client";

import dynamic from "next/dynamic";
import { useTerminalStore } from "@/stores/terminal-store";

// xterm touches `window` and `document` on import — must be client-only.
const TerminalDock = dynamic(
  () => import("./terminal-dock").then((m) => m.TerminalDock),
  { ssr: false },
);

export function TerminalDockWrapper() {
  const isOpen = useTerminalStore((s) => s.isOpen);
  if (!isOpen) return null;
  return <TerminalDock />;
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/terminal-dock.tsx components/terminal-dock-wrapper.tsx
git commit -m "feat(terminal): add TerminalDock component with xterm.js"
```

---

## Task 7: Global hotkey hook

**Files:**
- Create: `components/use-terminal-hotkey.tsx`

- [ ] **Step 1: Implement the hotkey component**

Create `components/use-terminal-hotkey.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useTerminalStore } from "@/stores/terminal-store";

/**
 * Listens for Cmd+` (mac) / Ctrl+` (win/linux) at the window level and toggles
 * the terminal dock. Renders nothing.
 */
export function TerminalHotkey() {
  const toggle = useTerminalStore((s) => s.toggle);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isToggleKey = e.key === "`" && (e.metaKey || e.ctrlKey);
      if (!isToggleKey) return;
      e.preventDefault();
      e.stopPropagation();
      toggle();
    };
    // capture: true ensures the hotkey always fires, even when focus is inside
    // xterm (which may stop propagation on some keys).
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [toggle]);

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/use-terminal-hotkey.tsx
git commit -m "feat(terminal): add Cmd+\` / Ctrl+\` global hotkey"
```

---

## Task 8: Integrate dock into root layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Wrap children in a vertical PanelGroup**

Replace `app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { SidebarWrapper } from "@/components/sidebar-wrapper";
import { ThemeProviderWrapper } from "@/components/theme-provider-wrapper";
import { TerminalHotkey } from "@/components/use-terminal-hotkey";
import { LayoutShell } from "@/components/layout-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harness Hub",
  description: "Claude Code harness manager",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-gray-50/80 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased font-sans">
        <ThemeProviderWrapper />
        <SidebarWrapper />
        <LayoutShell>{children}</LayoutShell>
        <TerminalHotkey />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create LayoutShell client component**

Why a separate client component: `react-resizable-panels` requires `"use client"`, but `app/layout.tsx` should remain a server component to keep `metadata` export valid.

Create `components/layout-shell.tsx`:

```typescript
"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useTerminalStore } from "@/stores/terminal-store";
import { TerminalDockWrapper } from "./terminal-dock-wrapper";

/**
 * Why no `autoSaveId`: react-resizable-panels' `defaultSize` only applies on
 * first mount. If we persisted the layout, toggling the terminal would get
 * confused because the saved ratio would override our `isOpen ? 65 : 100`
 * intent. For MVP, always start fresh with 65/35.
 *
 * Two PanelGroups depending on `isOpen`: when closed, a single Panel takes the
 * whole area; when open, two panels split. Re-keying the PanelGroup on `isOpen`
 * guarantees `defaultSize` is re-applied each time the dock appears.
 */
export function LayoutShell({ children }: { children: React.ReactNode }) {
  const isOpen = useTerminalStore((s) => s.isOpen);

  const mainContent = (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-w-0">
      {isOpen ? (
        <PanelGroup key="with-terminal" direction="vertical">
          <Panel defaultSize={65} minSize={20}>
            {mainContent}
          </Panel>
          <PanelResizeHandle className="h-1 bg-gray-800 transition-colors hover:bg-amber-500" />
          <Panel defaultSize={35} minSize={15} maxSize={70}>
            <TerminalDockWrapper />
          </Panel>
        </PanelGroup>
      ) : (
        <div className="flex-1 overflow-hidden">{mainContent}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run dev to smoke-test layout (no terminal yet, just verify nothing broke)**

Run: `pnpm dev` (web mode is fine for this check)
Open `http://127.0.0.1:3000/`. Verify the existing pages still render normally.
Stop the server.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx components/layout-shell.tsx
git commit -m "feat(terminal): integrate dock into layout with vertical PanelGroup"
```

---

## Task 9: Documentation (HARD GATE per CLAUDE.md)

**Files:**
- Create: `docs/features/terminal.md`
- Modify: `README.md`

- [ ] **Step 1: Write the feature doc**

Create `docs/features/terminal.md`:

```markdown
# Terminal

## 역할

Harness Hub 윈도우 안에서 셸을 띄워, GUI로 하네스 상태를 보면서 같은 화면에서 명령(특히 `claude` CLI)을 칠 수 있게 한다.

## 기능

- 하단 도킹 패널에 단일 터미널
- `Cmd+\`` (macOS) / `Ctrl+\`` (Windows/Linux) 토글
- **작업 디렉토리는 터미널을 여는 시점의 페이지로 결정되고, 이후 세션 내내 고정**:
  - `/hooks` → `~/.claude/hooks/`
  - `/skills` → `~/.claude/skills/`
  - `/commands` → `~/.claude/commands/`
  - `/agents`, `/plugins`, `/mcp`, `/rules`, `/memory` → 동일 패턴
  - 그 외 → `~/.claude/`
- 터미널을 연 뒤 사이드바에서 다른 페이지로 이동해도 **PTY는 그대로 살아있고 작업 디렉토리도 변하지 않는다**. 다른 디렉토리의 터미널을 원하면 닫고 다시 연다
- 패널 크기 조절은 수직 리사이즈 핸들로
- 사용자가 GUI 편집기와 같은 파일을 터미널에서 동시에 만지는 경우, 기존 `lib/file-ops.ts`의 mtime 가드가 그대로 보호한다 (Harness Hub가 새로 만든 동시 writer가 아니라, 사용자가 직접 친 명령이므로)

## 데이터 소스

- `node-pty`로 호스트 머신의 셸 spawn
- 환경 변수는 Electron 메인 프로세스의 `process.env`를 그대로 상속

## 플랫폼별 동작

셸 선택 우선순위는 모든 플랫폼에서 다음과 같다:

1. **`HARNESS_HUB_SHELL` 환경변수** (있으면 그대로 사용)
2. 플랫폼 기본값:
   - **macOS/Linux**: `$SHELL` 환경변수 → 없으면 `/bin/zsh`
   - **Windows**: `powershell.exe` (PS 5.1, 모든 Windows에 기본 탑재)
     - `COMSPEC`은 읽지 않는다 — Windows에서 COMSPEC은 거의 항상 `cmd.exe`인데, cmd.exe를 기본으로 주는 건 PowerShell보다 안 좋은 UX라서 의도적으로 배제
     - `pwsh.exe` (PowerShell 7) 또는 `cmd.exe`를 쓰고 싶으면 `HARNESS_HUB_SHELL=pwsh.exe` 같이 override
   - Git Bash for Windows가 `SHELL=/usr/bin/bash`를 설정해뒀어도, 플랫폼 분기가 먼저 걸려 native Windows 셸이 선택됨

**ConPTY 및 Windows 요구사항**:
- node-pty가 Windows 10 1809+에서 ConPTY를 자동 선택. 그 미만 Windows에서는 winpty로 fallback 시도, 그것도 실패하면 터미널 spawn 자체가 실패한다 (알려진 제약)

## 관련 파일

| 파일 | 역할 |
|---|---|
| `electron-src/terminal-manager.ts` | PTY 세션 lifecycle 관리 |
| `electron-src/main.ts` | IPC 핸들러 등록, 종료 시 killAll |
| `electron-src/preload.ts` | `window.electronTerminal` 노출 |
| `lib/page-cwd.ts` | pathname → cwd 매핑 (순수 함수) |
| `stores/terminal-store.ts` | open/closed, cwd override 상태 |
| `components/terminal-dock.tsx` | xterm.js 마운트, IPC 와이어링 |
| `components/terminal-dock-wrapper.tsx` | dynamic import (xterm은 브라우저 전용) |
| `components/use-terminal-hotkey.tsx` | 글로벌 단축키 |
| `components/layout-shell.tsx` | 수직 PanelGroup으로 dock 배치 |
| `types/electron-terminal.d.ts` | window.electronTerminal 타입 선언 |

## 알려진 제약

- 단일 터미널만 지원 (탭 없음). MVP 범위 결정.
- 웹 dev 모드(`pnpm dev`)에서는 `window.electronTerminal`이 없어 안내 문구만 표시. 터미널은 Electron 모드에서만 동작.
- node-pty는 네이티브 모듈이라 첫 설치 시 `electron-builder install-app-deps`가 자동으로 Electron ABI에 맞춰 재컴파일. CI에서 이 단계 실패 시 빌드가 빨갛게 됨.
- 에이전트 자동 호출/컨텍스트 주입 같은 "GUI가 에이전트에게 명령" 기능은 명시적으로 범위 외 (Devil's Advocate 리뷰에서 동시 writer 위험으로 BLOCK 판정).
```

- [ ] **Step 2: Update README Features table**

Open `README.md`, find the Features table, add a row:

```markdown
| Terminal | 하단 도킹 셸 패널 (xterm.js + node-pty), 페이지별 cwd 자동 결정, `Cmd+\`` 토글 | [docs](docs/features/terminal.md) |
```

(Adapt the row format to match the existing table style — check first.)

- [ ] **Step 3: Commit**

```bash
git add docs/features/terminal.md README.md
git commit -m "docs(terminal): document embedded terminal feature"
```

---

## Task 10: End-to-end smoke test

**Files:** none (manual)

- [ ] **Step 1: Build Electron app in dev mode**

Run: `pnpm electron:dev`
Expected: window opens, Next.js loads, no native module errors in console.

- [ ] **Step 2: Open the terminal**

Press `Cmd+\`` (mac) or `Ctrl+\`` (win/linux).
Expected: bottom panel slides in showing a shell prompt with cwd `~/.claude`.

- [ ] **Step 3: Verify per-page cwd is captured at open time**

- Navigate to the Hooks page first. Press `Cmd+\`` to open the terminal. Header should show cwd `~/.claude/hooks`.
- Run `pwd` in the terminal. Expected: `/Users/<you>/.claude/hooks`.
- Click sidebar → Skills. **The terminal should NOT restart.** Running `pwd` again should still print `/Users/<you>/.claude/hooks` (the shell is still in the original directory).
- Press `Cmd+\`` to close, then navigate to Skills, then press `Cmd+\`` again. Now header should show `~/.claude/skills` and `pwd` prints `/Users/<you>/.claude/skills`.
- This confirms the "cwd frozen at open time, PTY persists across navigation" design.

- [ ] **Step 4: Verify claude CLI works**

In the terminal, run: `claude --version`
Expected: prints the installed Claude Code version.

(If `claude` is not on PATH, this is fine — that's a user environment issue, not a Harness Hub bug.)

- [ ] **Step 5: Verify resize**

Drag the resize handle up and down. xterm should re-fit without artifacts.

- [ ] **Step 6: Verify close + reopen**

Press `Cmd+\`` to close, then again to open. Expected: a fresh PTY session is created (not the previous one — that's killed on close).

- [ ] **Step 7: Verify quit cleanup**

Quit the app. Expected: no orphan shell processes left behind.

Run on macOS: `ps aux | grep -i zsh | grep -v grep`
Confirm none point to Harness Hub.

- [ ] **Step 8: Verify node-pty native binary survives asar packaging (required before release)**

Run: `pnpm electron:build:mac`
After the build finishes, verify the native `.node` binary is unpacked outside asar:

```bash
ls "dist/mac-arm64/Harness Hub.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/"
```

(Path may vary by architecture — check `dist/mac*/Harness Hub.app/...`.)

Expected: a `pty.node` (or similar) binary exists at that path. If it does NOT, the packaged app will crash at runtime with "Cannot find module" even though `pnpm electron:dev` works. Fix by updating `electron-builder.yml` `asarUnpack` to explicitly include `node_modules/node-pty/**/*`.

- [ ] **Step 9: Windows smoke test (if a Windows machine is available or via CI build)**

Navigate to Hooks page first, then press `Ctrl+\`` to open the terminal.
- Expected: **PowerShell** prompt appears (not cmd.exe) with cwd `C:\Users\<you>\.claude\hooks`.
- Run `Get-Location` in the terminal. Expected: `C:\Users\<you>\.claude\hooks`.
- Run `claude --version` (if Claude Code CLI is installed in PATH). Expected: prints version.
- Close the terminal with `Ctrl+\``, navigate to Skills, reopen. Expected: fresh PowerShell session with cwd `C:\Users\<you>\.claude\skills`.
- Quit the app. Open Task Manager. Expected: no orphan `powershell.exe` or `conhost.exe` processes tied to Harness Hub.

If a Windows machine is not available, rely on the GitHub Actions `electron:build:win` job to at least verify the build and native rebuild succeed. Full runtime verification then waits for a real user on Windows.

- [ ] **Step 10: If everything passes, no commit needed (smoke test only)**

If a bug surfaces, fix it as a focused commit before moving on.

---

## Final verification

- [ ] **Step 1: Run the full test suite**

Run: `pnpm vitest run --config vitest.config.node.mts`
Expected: all tests pass, including new `page-cwd` and `terminal-manager` suites.

- [ ] **Step 2: Type-check the whole project**

Run: `pnpm tsc --noEmit && pnpm tsc -p tsconfig.electron.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 4: (Optional) Test packaged build**

Run: `pnpm electron:build:mac`
Expected: `.dmg` produced; install and verify terminal works in the packaged app. node-pty native binary is correctly unpacked from asar.

This step is optional for development but **required before cutting a release**.

---

## Skills referenced

- @superpowers:test-driven-development — for Tasks 2, 3
- @superpowers:verification-before-completion — before claiming any task complete
- @superpowers:executing-plans or @superpowers:subagent-driven-development — for executing this plan
