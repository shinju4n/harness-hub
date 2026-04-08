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
