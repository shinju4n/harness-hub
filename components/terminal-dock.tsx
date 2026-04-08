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
    console.log("[term] effect running");
    if (!containerRef.current) return;
    const api = window.electronTerminal;
    if (!api) {
      console.log("[term] window.electronTerminal missing — web mode");
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
    console.log("[term] xterm opened, cols/rows:", term.cols, term.rows);

    // Attach listeners BEFORE create(). Single-terminal MVP, so no id filter
    // is needed — whatever session exists is this one.
    let activeId: string | null = null;
    let disposed = false;

    const unsubData = api.onData((id, data) => {
      console.log("[term] pty->xterm data:", JSON.stringify(data.slice(0, 40)), "id:", id);
      term.write(data);
    });
    const unsubExit = api.onExit((id, code) => {
      console.log("[term] pty exit:", id, "code:", code);
      term.write("\r\n\x1b[33m[process exited]\x1b[0m\r\n");
      activeId = null;
    });

    // Register xterm -> PTY forwarding synchronously. `activeId` is populated
    // after create() resolves; keystrokes before that are dropped (very brief
    // window), keystrokes after flow straight through.
    term.onData((data) => {
      console.log("[term] xterm->pty data:", JSON.stringify(data), "activeId:", activeId);
      if (activeId) api.write(activeId, data);
    });
    term.onResize(({ cols, rows }) => {
      if (activeId) api.resize(activeId, cols, rows);
    });

    api
      .create({ cwd: sessionCwd, cols: term.cols, rows: term.rows })
      .then((id) => {
        console.log("[term] create resolved:", id, "disposed:", disposed);
        if (disposed) {
          api.kill(id);
          return;
        }
        activeId = id;
        // Focus xterm AFTER PTY is ready. Delay one tick so the helper
        // textarea is fully attached to the DOM.
        setTimeout(() => {
          console.log("[term] focusing xterm");
          term.focus();
        }, 0);
      })
      .catch((err) => {
        console.error("[term] create failed:", err);
        term.write(`\r\n\x1b[31mFailed to start terminal: ${err.message}\x1b[0m\r\n`);
      });

    // Clicking anywhere in the dock should focus xterm as a safety net.
    const onContainerClick = () => term.focus();
    containerRef.current.addEventListener("click", onContainerClick);

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
      console.log("[term] cleanup running, activeId:", activeId);
      disposed = true;
      resizeObserver.disconnect();
      containerRef.current?.removeEventListener("click", onContainerClick);
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
