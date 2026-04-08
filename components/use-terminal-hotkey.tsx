"use client";

import { useEffect } from "react";
import { useTerminalStore } from "@/stores/terminal-store";
import { useAppSettingsStore, hotkeyMatchesEvent } from "@/stores/app-settings-store";

/**
 * Listens for the user-configured terminal toggle hotkey at the window level
 * and toggles the terminal dock. Renders nothing.
 *
 * The default binding is `Ctrl+\`` (all platforms). The user can rebind it
 * from App Settings → Terminal Hotkey, or set it to `null` to disable the
 * keyboard toggle entirely (mouse-only).
 *
 * Why Ctrl and not Cmd on macOS by default: macOS reserves Cmd+` system-wide
 * for "cycle windows of the same app" — the key event never reaches the
 * Electron webview. We accept arbitrary user-chosen bindings here, but the
 * default sticks with the cross-platform Ctrl variant for that reason.
 *
 * **Recording suspension**: when the App Settings hotkey recorder is active
 * (`isRecordingHotkey === true` in the app settings store), this listener
 * suspends itself entirely. Otherwise the user could not rebind the *current*
 * combo to itself, or to any other already-bound combo, because this listener
 * would `preventDefault` and `stopPropagation` before the recorder ever saw
 * the keystroke.
 */
export function TerminalHotkey() {
  const toggle = useTerminalStore((s) => s.toggle);
  const hotkey = useAppSettingsStore((s) => s.terminalHotkey);
  const isRecording = useAppSettingsStore((s) => s.isRecordingHotkey);

  useEffect(() => {
    if (!hotkey) return;
    if (isRecording) return;

    const handler = (e: KeyboardEvent) => {
      if (!hotkeyMatchesEvent(hotkey, e)) return;
      e.preventDefault();
      e.stopPropagation();
      toggle();
    };
    // capture: true ensures the hotkey always fires, even when focus is inside
    // xterm (which may stop propagation on some keys).
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [toggle, hotkey, isRecording]);

  return null;
}
