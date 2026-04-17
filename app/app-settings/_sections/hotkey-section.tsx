"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_TERMINAL_HOTKEY,
  formatHotkey,
  isOsReservedHotkey,
  useAppSettingsStore,
} from "@/stores/app-settings-store";
import type { TerminalHotkey } from "@/stores/app-settings-store";

export function HotkeySection() {
  const terminalHotkey = useAppSettingsStore((s) => s.terminalHotkey);
  const setTerminalHotkey = useAppSettingsStore((s) => s.setTerminalHotkey);
  const resetTerminalHotkey = useAppSettingsStore((s) => s.resetTerminalHotkey);
  const setRecordingFlag = useAppSettingsStore((s) => s.setRecordingHotkey);

  const [recordingHotkey, setRecordingHotkey] = useState(false);

  /**
   * Hotkey recording uses a window-level capture listener while
   * `recordingHotkey === true`. Capture phase + the global terminal hotkey
   * listener suspending itself (via `isRecordingHotkey` in the store) means
   * we always see the keystroke first, even if the user picks the same combo
   * that's currently bound — avoiding the "rebind to current combo just
   * toggles the dock" footgun.
   *
   * The store's `isRecordingHotkey` flag is set synchronously by the Record
   * button's onClick handler (not from inside this effect) so the global
   * listener tears down before React schedules the re-render, eliminating
   * the sub-millisecond window where a keystroke could leak through.
   *
   * Modifier-only presses are ignored so bare Ctrl/Shift/Meta/Alt don't
   * commit a useless binding.
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
      // Belt-and-suspenders: also clear the flag on unmount.
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

  return (
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
              // recorder's re-render.
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
  );
}
