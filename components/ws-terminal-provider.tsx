"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useTerminalStore } from "@/stores/terminal-store";
import { TERMINAL_THEME } from "@/lib/terminal-theme";

type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

const MAX_RECONNECT = 3;
const RECONNECT_DELAY = 2000;

const STATUS_DOT: Record<ConnectionState, string> = {
  idle: "bg-gray-500",
  connecting: "bg-amber-500 animate-pulse",
  connected: "bg-green-500",
  disconnected: "bg-gray-500",
  reconnecting: "bg-amber-500 animate-pulse",
  error: "bg-red-500",
};

const STATUS_LABEL: Record<ConnectionState, string> = {
  idle: "Idle",
  connecting: "Connecting...",
  connected: "Connected",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting...",
  error: "Connection failed",
};

function getWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/terminal`;
}

export function WsTerminalProvider() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ConnectionState>("idle");
  const [sessionCwd, setSessionCwd] = useState("...");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", monospace',
      fontSize: 13,
      lineHeight: 1.35,
      theme: TERMINAL_THEME,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    let ws: WebSocket | null = null;
    let activeId: string | null = null;
    let disposed = false;
    let reconnectCount = 0;

    function send(msg: Record<string, unknown>) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }

    function connect() {
      if (disposed) return;
      setState(reconnectCount > 0 ? "reconnecting" : "connecting");

      ws = new WebSocket(getWsUrl());

      ws.onopen = () => {
        if (disposed) {
          ws?.close();
          return;
        }
        reconnectCount = 0;
        send({ type: "create", cols: term.cols, rows: term.rows });
      };

      ws.onmessage = (event) => {
        let msg: {
          type: string;
          id?: string;
          data?: string;
          cwd?: string;
          code?: number;
          message?: string;
        };
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (msg.type) {
          case "created":
            activeId = msg.id!;
            setSessionCwd(msg.cwd || "~");
            setState("connected");
            setTimeout(() => {
              if (!disposed) term.focus();
            }, 0);
            break;
          case "data":
            if (msg.id === activeId) term.write(msg.data!);
            break;
          case "exit":
            if (msg.id === activeId) {
              term.write(
                "\r\n\x1b[33m[process exited]\x1b[0m\r\n",
              );
              activeId = null;
            }
            break;
          case "error":
            term.write(
              `\r\n\x1b[31m[error] ${msg.message}\x1b[0m\r\n`,
            );
            break;
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        activeId = null;
        if (reconnectCount < MAX_RECONNECT) {
          reconnectCount++;
          setState("reconnecting");
          setTimeout(connect, RECONNECT_DELAY);
        } else {
          setState("error");
          term.write(
            "\r\n\x1b[31m[disconnected — reload to retry]\x1b[0m\r\n",
          );
        }
      };

      ws.onerror = () => {
        // onclose will fire after this
      };
    }

    // xterm -> WS forwarding
    term.onData((data) => {
      if (activeId) send({ type: "data", id: activeId, data });
    });
    term.onResize(({ cols, rows }) => {
      if (activeId) send({ type: "resize", id: activeId, cols, rows });
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // fit() can throw during unmount
      }
    });
    resizeObserver.observe(container);

    connect();

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      if (activeId && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "kill", id: activeId }));
      }
      ws?.close();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-gray-800/80 bg-gradient-to-r from-gray-900 to-gray-900/95 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[state]} ${state === "connected" ? "shadow-[0_0_4px_rgba(34,197,94,0.4)]" : ""}`} />
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </div>
          <span className="text-gray-400 truncate font-mono text-[11px]">{sessionCwd}</span>
          {state !== "connected" && (
            <span className="text-gray-500 text-[11px] shrink-0">({STATUS_LABEL[state]})</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => useTerminalStore.getState().setOpen(false)}
            className="rounded-md p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            aria-label="Close terminal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden p-2" />
    </div>
  );
}
