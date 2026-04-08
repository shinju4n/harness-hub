"use client";

import { useEffect } from "react";
import { useTerminalStore } from "@/stores/terminal-store";

/**
 * Listens for Ctrl+` (all platforms) at the window level and toggles the
 * terminal dock. Renders nothing.
 *
 * Why not Cmd+` on macOS: macOS reserves Cmd+` system-wide for "cycle windows
 * of the same app" — the key event never reaches the Electron webview. We
 * accept metaKey in the matcher as a harmless fallback in case a user has
 * rebound the OS shortcut, but Ctrl+` is the documented default everywhere.
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
