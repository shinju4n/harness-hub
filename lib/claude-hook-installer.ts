/**
 * claude-hook-installer.ts
 *
 * Manages installation and removal of a PostToolUse http hook in Claude Code
 * settings.json. Our hook fires after Edit|Write tool calls and notifies the
 * local harness-hub server to rescan affected files.
 *
 * Identity: we recognise our entry by the presence of header
 *   "x-harness-hub-hook": "1"
 * on the http hook object. This lets us find and remove only our entry without
 * disturbing any user-configured hooks.
 *
 * Write strategy: backup → tmp write → rename (no fsync needed for settings).
 */

import { readFile, writeFile, rename, copyFile, mkdir } from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOOK_URL = "http://127.0.0.1:3000/api/rescan";
const HOOK_MATCHER = "Edit|Write";
const IDENTITY_HEADER_KEY = "x-harness-hub-hook";
const IDENTITY_HEADER_VALUE = "1";

// ---------------------------------------------------------------------------
// Types (minimal subset of Claude Code settings schema)
// ---------------------------------------------------------------------------

interface HttpHookEntry {
  type: "http";
  url: string;
  headers?: Record<string, string>;
  timeout_ms?: number;
}

type HookEntry = HttpHookEntry | { type: string; [key: string]: unknown };

interface MatcherGroup {
  matcher: string;
  hooks: HookEntry[];
}

interface ClaudeSettings {
  hooks?: {
    PostToolUse?: MatcherGroup[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readSettings(settingsPath: string): Promise<ClaudeSettings> {
  try {
    const raw = await readFile(settingsPath, "utf-8");
    return JSON.parse(raw) as ClaudeSettings;
  } catch (err: unknown) {
    // If file doesn't exist, start with empty settings
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw err;
  }
}

async function writeSettings(settingsPath: string, settings: ClaudeSettings): Promise<void> {
  // Ensure parent directory exists
  await mkdir(path.dirname(settingsPath), { recursive: true });

  // Backup existing file (best-effort)
  try {
    const backupPath = settingsPath.replace(/\.json$/, ".backup.json");
    await copyFile(settingsPath, backupPath);
  } catch {
    // No existing file to back up — that's fine
  }

  // Write via tmp + rename
  const tmpPath = settingsPath + ".tmp";
  const json = JSON.stringify(settings, null, 2) + "\n";
  await writeFile(tmpPath, json, "utf-8");
  await rename(tmpPath, settingsPath);
}

function isOurHook(hook: HookEntry): boolean {
  if (hook.type !== "http") return false;
  const httpHook = hook as HttpHookEntry;
  return (
    httpHook.url === HOOK_URL &&
    httpHook.headers?.[IDENTITY_HEADER_KEY] === IDENTITY_HEADER_VALUE
  );
}

function isOurMatcherGroup(group: MatcherGroup): boolean {
  return group.hooks.some(isOurHook);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Install the harness-hub PostToolUse hook into settings.json.
 * Idempotent — calling a second time is a no-op.
 */
export async function installHook(settingsPath: string): Promise<void> {
  const settings = await readSettings(settingsPath);

  // Ensure hooks.PostToolUse exists
  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!Array.isArray(settings.hooks.PostToolUse)) {
    settings.hooks.PostToolUse = [];
  }

  // Idempotency check — already installed?
  if (settings.hooks.PostToolUse.some(isOurMatcherGroup)) {
    return;
  }

  // Append our matcher group (never mutate existing entries)
  settings.hooks.PostToolUse = [
    ...settings.hooks.PostToolUse,
    {
      matcher: HOOK_MATCHER,
      hooks: [
        {
          type: "http",
          url: HOOK_URL,
          headers: {
            [IDENTITY_HEADER_KEY]: IDENTITY_HEADER_VALUE,
          },
        } satisfies HttpHookEntry,
      ],
    },
  ];

  await writeSettings(settingsPath, settings);
}

/**
 * Remove the harness-hub PostToolUse hook from settings.json.
 * Leaves all other hooks untouched.
 */
export async function uninstallHook(settingsPath: string): Promise<void> {
  const settings = await readSettings(settingsPath);

  if (!settings.hooks?.PostToolUse) {
    return; // Nothing to remove
  }

  settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
    (group) => !isOurMatcherGroup(group)
  );

  await writeSettings(settingsPath, settings);
}

/**
 * Returns true if the harness-hub hook is currently installed.
 */
export async function isHookInstalled(settingsPath: string): Promise<boolean> {
  const settings = await readSettings(settingsPath);
  return (settings.hooks?.PostToolUse ?? []).some(isOurMatcherGroup);
}
