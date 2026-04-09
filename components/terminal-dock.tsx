"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useTerminalStore } from "@/stores/terminal-store";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { WsTerminalProvider } from "./ws-terminal-provider";

export function TerminalDock() {
  const [useWs, setUseWs] = useState(false);

  useEffect(() => {
    if (!window.electronTerminal) {
      setUseWs(true);
    }
  }, []);

  if (useWs) {
    return <WsTerminalProvider />;
  }

  return <ElectronTerminal />;
}

function ElectronTerminal() {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const [sessionCwd, setSessionCwd] = useState<string>("...");
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const api = window.electronTerminal;
    if (!api) return;

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
    term.open(container);
    fit.fit();

    let activeId: string | null = null;
    let disposed = false;

    // In React Strict Mode the effect runs twice. Filter events by id so
    // foreign PTYs (from the first, disposed effect) don't clobber our state.
    const unsubData = api.onData((id, data) => {
      if (id !== activeId) return;
      term.write(data);
    });
    const unsubExit = api.onExit((id) => {
      if (id !== activeId) return;
      term.write("\r\n\x1b[33m[process exited]\x1b[0m\r\n");
      activeId = null;
    });

    // Register xterm -> PTY forwarding synchronously.
    term.onData((data) => {
      if (activeId) api.write(activeId, data);
    });
    term.onResize(({ cols, rows }) => {
      if (activeId) api.resize(activeId, cols, rows);
    });

    // Read the active profile's claude home at the moment of opening.
    // "auto" becomes null so the main process applies its default resolution.
    const profile = useAppSettingsStore.getState().getActiveProfile();
    const claudeHome = profile.homePath === "auto" ? null : profile.homePath;

    api
      .create({ pathname, claudeHome, cols: term.cols, rows: term.rows })
      .then((result) => {
        if (disposed) {
          api.kill(result.id);
          return;
        }
        activeId = result.id;
        setSessionCwd(result.cwd);
        // Focus xterm AFTER PTY is ready. Delay one tick so the helper
        // textarea is fully attached to the DOM. Guard with `disposed`
        // so we don't touch a disposed terminal if unmount races the timer.
        setTimeout(() => {
          if (disposed) return;
          term.focus();
        }, 0);
      })
      .catch((err) => {
        console.error("[term] create failed:", err);
        term.write(`\r\n\x1b[31mFailed to start terminal: ${err.message}\x1b[0m\r\n`);
      });

    // ResizeObserver so panel drag resizes refit xterm (window.resize does not fire).
    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // fit() can throw during unmount — ignore.
      }
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      unsubData();
      unsubExit();
      if (activeId) api.kill(activeId);
      activeId = null;
      term.dispose();
    };
    // Empty deps: run exactly once per mount. Pathname changes must NOT
    // recreate the PTY.
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
