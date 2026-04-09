import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Profile {
  id: string;
  name: string;
  homePath: string; // "auto" = default detection, or absolute path
}

/**
 * Structured representation of a keyboard shortcut.
 *
 * Modifiers and the matched key are stored as separate fields rather than a
 * "Ctrl+`" style string so the matcher in `use-terminal-hotkey.tsx` can do
 * a trivial field-by-field comparison, serialization survives persist
 * version bumps without parsing user-visible text, and the UI is free to
 * localize modifier glyphs (e.g. ⌘ on macOS) without re-parsing.
 *
 * `code` holds the value of `KeyboardEvent.code` and is matched first
 * because it is layout-independent ("Backquote" stays the same on
 * US-QWERTY, German-QWERTZ, French-AZERTY, etc.). `key` (the value of
 * `KeyboardEvent.key`) is the fallback when `code` is empty — that
 * happens for legacy bindings persisted before the `code` field existed,
 * which the migration upgrades by adding `code: ""`. A `null` hotkey
 * disables the keyboard toggle entirely; the dock can still be opened by
 * clicking the toolbar.
 */
export interface TerminalHotkey {
  key: string;
  /** `KeyboardEvent.code` for layout-independent matching. May be empty for legacy persisted bindings. */
  code: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

export const DEFAULT_TERMINAL_HOTKEY: TerminalHotkey = {
  key: "`",
  code: "Backquote",
  ctrl: true,
  meta: false,
  shift: false,
  alt: false,
};

/**
 * Validate that an arbitrary value is a well-formed TerminalHotkey. Used by
 * the persist migration to drop malformed blobs (e.g. an old hand-edit) and
 * fall back to the default rather than silently disabling the binding.
 */
/**
 * Structural check used by `migrateAppSettings` and the persist
 * rehydration path. We deliberately accept records WITHOUT a `code` field
 * because that's how legacy v2 (pre-code-field) bindings look on disk;
 * the migration adds an empty `code` afterwards so the matcher's fallback
 * path activates.
 */
function isValidTerminalHotkey(value: unknown): value is { key: string; code?: string; ctrl: boolean; meta: boolean; shift: boolean; alt: boolean } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.key === "string" &&
    v.key.length > 0 &&
    typeof v.ctrl === "boolean" &&
    typeof v.meta === "boolean" &&
    typeof v.shift === "boolean" &&
    typeof v.alt === "boolean" &&
    (v.code === undefined || typeof v.code === "string")
  );
}

interface AppSettingsState {
  pollingEnabled: boolean;
  pollingInterval: number;
  navOrder: string[] | null;
  profiles: Profile[];
  activeProfileId: string;
  theme: "system" | "light" | "dark";
  terminalHotkey: TerminalHotkey | null;
  /**
   * Transient flag set by the App Settings recording UI. While true, the
   * global terminal hotkey listener (`use-terminal-hotkey.tsx`) suspends
   * itself so the user can rebind the *current* combo without it firing the
   * dock toggle and stealing the keystroke. Not persisted.
   */
  isRecordingHotkey: boolean;
  setPollingEnabled: (enabled: boolean) => void;
  setPollingInterval: (seconds: number) => void;
  setNavOrder: (order: string[]) => void;
  resetNavOrder: () => void;
  addProfile: (name: string, homePath: string) => void;
  removeProfile: (id: string) => void;
  updateProfile: (id: string, name: string, homePath: string) => void;
  setActiveProfile: (id: string) => void;
  getActiveProfile: () => Profile;
  setTheme: (theme: "system" | "light" | "dark") => void;
  setTerminalHotkey: (hotkey: TerminalHotkey | null) => void;
  resetTerminalHotkey: () => void;
  setRecordingHotkey: (recording: boolean) => void;
}

const DEFAULT_PROFILE: Profile = { id: "default", name: "Default", homePath: "auto" };

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set, get) => ({
      pollingEnabled: true,
      pollingInterval: 5,
      navOrder: null,
      profiles: [DEFAULT_PROFILE],
      activeProfileId: "default",
      theme: "system",
      terminalHotkey: DEFAULT_TERMINAL_HOTKEY,
      isRecordingHotkey: false,
      setPollingEnabled: (enabled) => set({ pollingEnabled: enabled }),
      setPollingInterval: (seconds) => set({ pollingInterval: seconds }),
      setNavOrder: (order) => set({ navOrder: order }),
      resetNavOrder: () => set({ navOrder: null }),
      addProfile: (name, homePath) => {
        const id = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({
          profiles: [...state.profiles, { id, name, homePath }],
        }));
      },
      removeProfile: (id) => {
        // Best-effort version history cleanup — fire and forget
        fetch(`/api/version-history?action=archiveProfile&id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        }).catch(() => {});
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
          activeProfileId: state.activeProfileId === id ? "default" : state.activeProfileId,
        }));
      },
      updateProfile: (id, name, homePath) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, name, homePath } : p
          ),
        }));
      },
      setActiveProfile: (id) => set({ activeProfileId: id }),
      setTheme: (theme) => set({ theme }),
      getActiveProfile: () => {
        const { profiles, activeProfileId } = get();
        return profiles.find((p) => p.id === activeProfileId) ?? DEFAULT_PROFILE;
      },
      setTerminalHotkey: (hotkey) => set({ terminalHotkey: hotkey }),
      resetTerminalHotkey: () => set({ terminalHotkey: DEFAULT_TERMINAL_HOTKEY }),
      setRecordingHotkey: (recording) => set({ isRecordingHotkey: recording }),
    }),
    {
      name: "harness-hub-settings",
      version: 3,
      migrate: migrateAppSettings,
      // `isRecordingHotkey` is transient — never persist it.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      partialize: ({ isRecordingHotkey, ...rest }) => rest,
    }
  )
);

/**
 * Persist migration. Exported for direct unit testing because the zustand
 * persist API does not expose a clean test seam.
 *
 * Cases handled:
 *   - `null` / non-object persisted state → return as-is, persist will use
 *     the store's initial state.
 *   - v1 (no `terminalHotkey` field) → inject the default.
 *   - v2 with a malformed `terminalHotkey` (wrong shape, hand-edit, type
 *     drift) → replace with the default rather than silently disabling.
 *   - v2 with `terminalHotkey: null` (user disabled) → preserve.
 *   - v2 with a legacy hotkey missing the `code` field → upgrade in place
 *     by leaving `code` empty; the listener will fall back to `key`-based
 *     matching for that one binding until the user re-records.
 *   - v2 → v3: `/claude-md` route added (split out of `/settings`). If the
 *     user has a customized `navOrder`, insert it just before `/settings` so
 *     it appears in a sensible spot instead of being appended to the end by
 *     the runtime "append unknown items" fallback.
 */
export function migrateAppSettings(persisted: unknown, version: number): unknown {
  if (!persisted || typeof persisted !== "object") return persisted;
  let blob = persisted as Record<string, unknown>;

  // v1 → v2: terminalHotkey field added.
  if (version < 2 && !("terminalHotkey" in blob)) {
    blob = { ...blob, terminalHotkey: DEFAULT_TERMINAL_HOTKEY };
  }

  // v2 → v3: insert /claude-md before /settings in any saved navOrder.
  if (version < 3 && Array.isArray(blob.navOrder)) {
    const order = (blob.navOrder as unknown[]).filter((x): x is string => typeof x === "string");
    if (!order.includes("/claude-md")) {
      const settingsIdx = order.indexOf("/settings");
      const insertAt = settingsIdx >= 0 ? settingsIdx : order.length;
      const next = [...order.slice(0, insertAt), "/claude-md", ...order.slice(insertAt)];
      blob = { ...blob, navOrder: next };
    }
  }

  // v2+: validate terminalHotkey shape. `null` is a legitimate value
  // (keyboard toggle disabled) so we let it through; everything else has to
  // pass the structural check or get reset.
  if ("terminalHotkey" in blob) {
    const hk = blob.terminalHotkey;
    if (hk === null) return blob;
    if (!isValidTerminalHotkey(hk)) {
      return { ...blob, terminalHotkey: DEFAULT_TERMINAL_HOTKEY };
    }
    // Legacy bindings (pre-`code`) get the field added as empty string so
    // the matcher's `code || key` fallback path activates.
    if (typeof (hk as { code?: unknown }).code !== "string") {
      return {
        ...blob,
        terminalHotkey: { ...(hk as Omit<TerminalHotkey, "code">), code: "" },
      };
    }
  }

  return blob;
}

/**
 * Cheap macOS detection from the renderer. Used to scope OS-specific
 * warnings (Cmd+Q etc.) so non-Mac users don't see noise. Returns false in
 * non-browser contexts (SSR, tests) so the warnings are suppressed there
 * by default — they always render in the client anyway.
 */
function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  // `navigator.platform` is deprecated but still the most reliable signal
  // in Electron. `userAgentData.platform` is preferred where available.
  const uad = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData;
  if (uad?.platform) return uad.platform === "macOS";
  return /Mac|iPhone|iPod|iPad/.test(navigator.platform);
}

/**
 * Known shortcuts that macOS swallows before they reach the Electron
 * webview. Returns `false` on non-macOS platforms so Linux/Windows users
 * don't see a "this is reserved by macOS" warning that doesn't apply.
 *
 * The check requires the modifier set to be *exactly* the OS-reserved one
 * (e.g. bare `Cmd+H`) — `Cmd+Shift+H` is unassigned and must NOT be flagged.
 */
export function isOsReservedHotkey(hotkey: TerminalHotkey): boolean {
  if (!isMacPlatform()) return false;
  // The OS-reserved combos all use Cmd alone (no Ctrl, no Shift, no Alt).
  if (!hotkey.meta || hotkey.ctrl || hotkey.shift || hotkey.alt) {
    // One special case: Cmd+` (cycle windows) is reserved even though it
    // looks the same as our default once you strip Ctrl. The default has
    // ctrl: true so it's already excluded; only flag the bare Cmd variant.
    return false;
  }
  // Match by `code` when present (layout-independent), else by `key`.
  const codeOrKey = hotkey.code || hotkey.key;
  switch (codeOrKey) {
    case "Backquote": // Cmd+`  → cycle windows
    case "`":
    case "KeyH":      // Cmd+H  → hide app
    case "h":
    case "H":
    case "KeyM":      // Cmd+M  → minimize
    case "m":
    case "M":
    case "KeyQ":      // Cmd+Q  → quit
    case "q":
    case "Q":
    case "KeyW":      // Cmd+W  → close window
    case "w":
    case "W":
      return true;
    default:
      return false;
  }
}

/**
 * Render a hotkey for display. macOS gets the canonical glyph stack
 * (⌃⌘⌥⇧) so the binding looks native; everywhere else falls back to ASCII
 * names that match the keys printed on PC keyboards.
 */
export function formatHotkey(hotkey: TerminalHotkey | null): string {
  if (!hotkey) return "Disabled";
  const mac = isMacPlatform();
  const parts: string[] = [];
  if (mac) {
    if (hotkey.ctrl) parts.push("⌃");
    if (hotkey.alt) parts.push("⌥");
    if (hotkey.shift) parts.push("⇧");
    if (hotkey.meta) parts.push("⌘");
  } else {
    if (hotkey.ctrl) parts.push("Ctrl");
    if (hotkey.meta) parts.push("Win");
    if (hotkey.alt) parts.push("Alt");
    if (hotkey.shift) parts.push("Shift");
  }
  // Spell out a couple of unprintable keys for readability.
  const rawKey = hotkey.key;
  const keyLabel =
    rawKey === " "
      ? "Space"
      : rawKey.length === 1
        ? rawKey.toUpperCase()
        : rawKey;
  if (mac) {
    // Mac glyphs concatenate without separators by convention.
    return parts.join("") + keyLabel;
  }
  parts.push(keyLabel);
  return parts.join("+");
}

/**
 * Compare a TerminalHotkey against a live KeyboardEvent. Centralized so the
 * listener and any future debug tooling agree on what "matches" means. We
 * prefer `e.code` (layout-independent) and only fall back to `e.key` when
 * the persisted binding has no `code` (legacy upgrade path).
 */
export function hotkeyMatchesEvent(hotkey: TerminalHotkey, e: KeyboardEvent): boolean {
  if (e.ctrlKey !== hotkey.ctrl) return false;
  if (e.metaKey !== hotkey.meta) return false;
  if (e.shiftKey !== hotkey.shift) return false;
  if (e.altKey !== hotkey.alt) return false;
  if (hotkey.code) {
    return e.code === hotkey.code;
  }
  // Legacy fallback: `key` is layout-dependent and Shift-flips letters,
  // so we case-insensitively compare to keep "Shift+a" and "Shift+A" the
  // same binding.
  return e.key.toLowerCase() === hotkey.key.toLowerCase();
}
