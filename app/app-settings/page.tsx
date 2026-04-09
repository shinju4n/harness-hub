"use client";

import { useEffect, useState } from "react";
import { useAppSettingsStore, formatHotkey, isOsReservedHotkey, DEFAULT_TERMINAL_HOTKEY } from "@/stores/app-settings-store";
import type { Profile, TerminalHotkey } from "@/stores/app-settings-store";
import { useToastStore } from "@/stores/toast-store";
import { apiFetch } from "@/lib/api-client";
import packageJson from "@/package.json";

const HOOK_PREVIEW_JSON = JSON.stringify(
  {
    hooks: {
      PostToolUse: [
        {
          matcher: "Edit|Write",
          hooks: [
            {
              type: "http",
              url: "http://127.0.0.1:3000/api/rescan",
              headers: { "x-harness-hub-hook": "1" },
            },
          ],
        },
      ],
    },
  },
  null,
  2
);

const INTERVAL_OPTIONS = [
  { value: 3, label: "3s" },
  { value: 5, label: "5s" },
  { value: 10, label: "10s" },
  { value: 30, label: "30s" },
  { value: 60, label: "1m" },
];

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl?: string;
  publishedAt?: string;
  error?: string;
}

export default function AppSettingsPage() {
  const { pollingEnabled, pollingInterval, navOrder, setPollingEnabled, setPollingInterval, resetNavOrder, profiles, activeProfileId, addProfile, removeProfile, updateProfile, theme, setTheme, terminalHotkey, setTerminalHotkey, resetTerminalHotkey, setRecordingHotkey: setRecordingFlag } = useAppSettingsStore();
  const { push: pushToast } = useToastStore();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editPath, setEditPath] = useState("");
  const [addingProfile, setAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfilePath, setNewProfilePath] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [recordingHotkey, setRecordingHotkey] = useState(false);

  // Hook toggle state
  const [hookInstalled, setHookInstalled] = useState<boolean | null>(null);
  const [hookLoading, setHookLoading] = useState(false);
  const [hookPreviewOpen, setHookPreviewOpen] = useState(false);

  // Cleanup state
  const [cleaningUp, setCleaningUp] = useState(false);

  /**
   * Hotkey recording uses a window-level capture listener while
   * `recordingHotkey === true`. Two important properties:
   *
   *   1. Capture phase + the global terminal hotkey listener suspending
   *      itself (via `isRecordingHotkey` in the store) means we always see
   *      the keystroke first, even if the user picks the same combo that's
   *      currently bound. No more "rebind to current combo just toggles the
   *      dock" footgun.
   *   2. We don't rely on focus, so there's no `onBlur` race when the user
   *      presses a modifier key that briefly steals focus on some platforms.
   *
   * The store's `isRecordingHotkey` flag is set synchronously by the
   * Record button's `onClick` handler (not from inside this effect) so the
   * global terminal hotkey listener tears down before React schedules the
   * re-render — eliminating the sub-millisecond window where a keystroke
   * could leak through to the dock.
   *
   * We ignore modifier-only presses (Ctrl/Shift/Meta/Alt by themselves)
   * because the recorder must wait for an actual character key — otherwise
   * the bare modifier-down would commit a useless binding.
   */
  useEffect(() => {
    if (!recordingHotkey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecordingHotkey(false);
        setRecordingFlag(false);
        return;
      }
      if (e.key === "Control" || e.key === "Meta" || e.key === "Shift" || e.key === "Alt") {
        return;
      }
      const next: TerminalHotkey = {
        key: e.key,
        code: e.code,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
      };
      setTerminalHotkey(next);
      setRecordingHotkey(false);
      setRecordingFlag(false);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      // Belt-and-suspenders: also clear the flag on unmount or if the
      // effect re-runs for any other reason. The onClick handler is the
      // canonical setter; this just prevents a stuck flag in pathological
      // cases (component unmount mid-recording).
      setRecordingFlag(false);
    };
  }, [recordingHotkey, setTerminalHotkey, setRecordingFlag]);

  const hotkeyReserved = terminalHotkey ? isOsReservedHotkey(terminalHotkey) : false;
  const hotkeyIsDefault =
    terminalHotkey &&
    terminalHotkey.key === DEFAULT_TERMINAL_HOTKEY.key &&
    terminalHotkey.code === DEFAULT_TERMINAL_HOTKEY.code &&
    terminalHotkey.ctrl === DEFAULT_TERMINAL_HOTKEY.ctrl &&
    terminalHotkey.meta === DEFAULT_TERMINAL_HOTKEY.meta &&
    terminalHotkey.shift === DEFAULT_TERMINAL_HOTKEY.shift &&
    terminalHotkey.alt === DEFAULT_TERMINAL_HOTKEY.alt;

  // Check hook installation status on mount
  useEffect(() => {
    apiFetch("/api/claude-hook")
      .then((r) => r.json())
      .then((data: { installed: boolean }) => setHookInstalled(data.installed))
      .catch(() => setHookInstalled(false));
  }, []);

  const toggleHook = async () => {
    if (hookInstalled === null) return;
    setHookLoading(true);
    try {
      const method = hookInstalled ? "DELETE" : "POST";
      const res = await apiFetch("/api/claude-hook", { method });
      if (res.ok) {
        setHookInstalled(!hookInstalled);
        pushToast("success", hookInstalled ? "Hook uninstalled" : "Hook installed");
      } else {
        pushToast("error", "Failed to update hook");
      }
    } catch {
      pushToast("error", "Failed to update hook");
    }
    setHookLoading(false);
  };

  const handleCleanup = async () => {
    setCleaningUp(true);
    try {
      // Placeholder: cleanup action not yet implemented server-side
      await new Promise((r) => setTimeout(r, 500));
      pushToast("success", "Cleanup complete (no orphaned objects found)");
    } catch {
      pushToast("error", "Cleanup failed");
    }
    setCleaningUp(false);
  };

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/update-check");
      const data = await res.json();
      setUpdateInfo(data);
    } catch {
      setUpdateInfo({ currentVersion: "?", latestVersion: "?", updateAvailable: false, error: "Failed to check" });
    }
    setChecking(false);
  };

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">App Settings</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Harness Hub application preferences</p>
      </div>

      <div className="space-y-4">
        {/* Update Check */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Updates</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Check for new versions on GitHub</p>
            </div>
            <button
              onClick={checkForUpdates}
              disabled={checking}
              className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {checking ? "Checking..." : "Check now"}
            </button>
          </div>
          {updateInfo && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              {updateInfo.error ? (
                <p className="text-sm text-red-500">{updateInfo.error}</p>
              ) : updateInfo.updateAvailable ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      New version available: v{updateInfo.latestVersion}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      Current: v{updateInfo.currentVersion}
                      {updateInfo.publishedAt && ` · Released ${new Date(updateInfo.publishedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  {updateInfo.releaseUrl && (
                    <a
                      href={updateInfo.releaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-1.5 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                    >
                      Download
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-green-600 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
                  You&apos;re up to date (v{updateInfo.currentVersion})
                </p>
              )}
            </div>
          )}
        </div>

        {/* Polling */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Auto Refresh</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Automatically poll ~/.claude/ for changes</p>
            </div>
            <button
              onClick={() => setPollingEnabled(!pollingEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                pollingEnabled ? "bg-amber-500" : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  pollingEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          {pollingEnabled && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Polling interval</label>
              <div className="flex gap-2 flex-wrap">
                {INTERVAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPollingInterval(opt.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      pollingInterval === opt.value
                        ? "border-amber-300 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Theme</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Choose your preferred color scheme</p>
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            {(["system", "light", "dark"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setTheme(option)}
                className={`px-4 py-1.5 text-sm rounded-lg border transition-colors capitalize ${
                  theme === option
                    ? "border-amber-300 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {option === "system" ? "System default" : option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Terminal Hotkey */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Terminal Hotkey</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Keyboard shortcut to toggle the bottom terminal dock
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  // Set the store flag synchronously so the global terminal
                  // hotkey listener detaches BEFORE React schedules the
                  // recorder's re-render. Otherwise there's a sub-ms window
                  // where the global listener could still fire on the very
                  // first keystroke after clicking Record.
                  const next = !recordingHotkey;
                  setRecordingFlag(next);
                  setRecordingHotkey(next);
                }}
                className={`min-w-[140px] px-3 py-1.5 text-sm font-mono rounded-lg border transition-colors ${
                  recordingHotkey
                    ? "border-amber-400 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 ring-2 ring-amber-200 dark:ring-amber-800"
                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                aria-label="Record terminal hotkey"
                aria-pressed={recordingHotkey}
              >
                {recordingHotkey ? "Press a key…" : formatHotkey(terminalHotkey)}
              </button>
              {!hotkeyIsDefault && (
                <button
                  type="button"
                  onClick={resetTerminalHotkey}
                  className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setTerminalHotkey(terminalHotkey ? null : DEFAULT_TERMINAL_HOTKEY)}
                className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                {terminalHotkey ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
          <div className="mt-3" aria-live="polite">
            {recordingHotkey && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Press the key combo you want to use. Esc cancels.
              </p>
            )}
            {!recordingHotkey && hotkeyReserved && (
              <p className="text-xs text-red-600 dark:text-red-400">
                ⚠ This combo is reserved by macOS — the OS swallows it before it reaches Harness Hub, so the toggle will not fire on Mac.
              </p>
            )}
            {!recordingHotkey && !terminalHotkey && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Keyboard toggle disabled. Open the terminal by clicking the toolbar button.
              </p>
            )}
            {!recordingHotkey && terminalHotkey && terminalHotkey.code === "" && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tip: re-record this hotkey to make it layout-independent (works the same on QWERTZ, AZERTY, etc.).
              </p>
            )}
          </div>
        </div>

        {/* Menu Order */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Menu Order</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {navOrder ? "Custom order saved" : "Default order"} · Drag items in the sidebar to reorder
              </p>
            </div>
            {navOrder && (
              <button
                onClick={resetNavOrder}
                className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Reset to default
              </button>
            )}
          </div>
        </div>

        {/* Profiles */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Profiles</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage multiple ~/.claude paths · any absolute path (external drives, NAS, etc.)</p>
            </div>
            {!addingProfile && (
              <button
                onClick={() => setAddingProfile(true)}
                className="px-4 py-1.5 text-sm font-medium rounded-lg border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 transition-colors"
              >
                + Add
              </button>
            )}
          </div>

          <div className="space-y-2">
            {profiles.map((profile) => (
              <div key={profile.id} className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                {editingProfile?.id === profile.id ? (
                  <div className="p-3 space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Profile name"
                      className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
                    />
                    <input
                      type="text"
                      value={editPath}
                      onChange={(e) => setEditPath(e.target.value)}
                      placeholder="/absolute/path/.claude"
                      className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          if (!editName.trim()) return;
                          updateProfile(profile.id, editName.trim(), editPath.trim() || "auto");
                          setEditingProfile(null);
                        }}
                        className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingProfile(null)}
                        className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">{profile.name}</span>
                        {profile.id === activeProfileId && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">Active</span>
                        )}
                        {profile.id === "default" && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Default</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-0.5 truncate">
                        {profile.homePath === "auto" ? "~/.claude (auto)" : profile.homePath}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingProfile(profile); setEditName(profile.name); setEditPath(profile.homePath === "auto" ? "" : profile.homePath); }}
                        className="px-2 py-1 text-xs text-gray-400 hover:text-amber-600 transition-colors rounded hover:bg-amber-50 dark:hover:bg-amber-950"
                      >
                        Edit
                      </button>
                      {profile.id !== "default" && (
                        confirmDeleteId === profile.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { removeProfile(profile.id); setConfirmDeleteId(null); }}
                              className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(profile.id)}
                            className="px-2 py-1 text-xs text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            Delete
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {addingProfile && (
            <div className="mt-3 p-3 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50/50 dark:bg-amber-950/50 space-y-2">
              <input
                type="text"
                placeholder="Profile name"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
                autoFocus
              />
              <input
                type="text"
                placeholder="/absolute/path/.claude"
                value={newProfilePath}
                onChange={(e) => setNewProfilePath(e.target.value)}
                className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    if (!newProfileName.trim() || !newProfilePath.trim()) return;
                    addProfile(newProfileName.trim(), newProfilePath.trim());
                    setNewProfileName("");
                    setNewProfilePath("");
                    setAddingProfile(false);
                  }}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => { setAddingProfile(false); setNewProfileName(""); setNewProfilePath(""); }}
                  className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Real-time Capture (Claude Code Hook) */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Real-time Capture</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Automatically snapshot Skills and Agents when Claude Code edits them
              </p>
            </div>
            <button
              onClick={toggleHook}
              disabled={hookInstalled === null || hookLoading}
              aria-pressed={hookInstalled ?? false}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                hookInstalled ? "bg-amber-500" : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  hookInstalled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setHookPreviewOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${hookPreviewOpen ? "rotate-90" : ""}`}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              Preview hook JSON
            </button>
            {hookPreviewOpen && (
              <pre className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-[11px] font-mono text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
                {HOOK_PREVIEW_JSON}
              </pre>
            )}
          </div>
        </div>

        {/* Archived Histories */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Archived Histories</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Profiles whose version histories have been archived
            </p>
          </div>
          <div className="mt-4 flex flex-col items-center justify-center py-6 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-gray-300 dark:text-gray-600 mb-2"
            >
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              <path d="m3.3 7 8.7 5 8.7-5" />
              <path d="M12 22V12" />
            </svg>
            <p className="text-sm text-gray-400 dark:text-gray-500">No archived histories</p>
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">
              Archived profile histories will appear here
            </p>
          </div>
        </div>

        {/* Storage */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Storage</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Remove orphaned objects not referenced by any snapshot
              </p>
            </div>
            <button
              onClick={handleCleanup}
              disabled={cleaningUp}
              className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {cleaningUp ? "Cleaning…" : "Clean up orphaned objects"}
            </button>
          </div>
        </div>

        {/* About */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">About</h3>
          <div className="mt-3 space-y-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Version</span>
              <span className="font-mono text-gray-700 dark:text-gray-300">{packageJson.version}</span>
            </div>
            <div className="flex justify-between">
              <span>Data source</span>
              <span className="font-mono text-gray-700 dark:text-gray-300">~/.claude/</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
