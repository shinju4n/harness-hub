import { WebSocket } from "ws";
import { homedir } from "os";
import {
  TerminalManager,
  createDefaultPtyFactory,
} from "./terminal-manager";

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

const MAX_SESSIONS_PER_CONNECTION = 5;
const MAX_SESSIONS_GLOBAL = 20;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Protocol types
// ---------------------------------------------------------------------------

type ClientMessage =
  | { type: "create"; cols: number; rows: number }
  | { type: "data"; id: string; data: string }
  | { type: "resize"; id: string; cols: number; rows: number }
  | { type: "kill"; id: string };

type ServerMessage =
  | { type: "created"; id: string; cwd: string }
  | { type: "data"; id: string; data: string }
  | { type: "exit"; id: string; code: number }
  | { type: "error"; message: string };

// ---------------------------------------------------------------------------
// Shared terminal manager (singleton)
// ---------------------------------------------------------------------------

let manager: TerminalManager | null = null;

// We need a per-session dispatch table because the shared TerminalManager
// instance fires callbacks globally, but each WebSocket connection only cares
// about its own sessions. We keep a Map<sessionId, WebSocket> and route
// accordingly.
const sessionOwners = new Map<string, WebSocket>();

// Lazily initialised exactly once.
let managerInitialised = false;

function ensureManager(): TerminalManager {
  if (!managerInitialised) {
    manager = new TerminalManager({
      ptyFactory: createDefaultPtyFactory(),
      onData: (id, data) => {
        const ws = sessionOwners.get(id);
        if (ws && ws.readyState === WebSocket.OPEN) {
          send(ws, { type: "data", id, data });
        }
      },
      onExit: (id, code) => {
        const ws = sessionOwners.get(id);
        if (ws && ws.readyState === WebSocket.OPEN) {
          send(ws, { type: "exit", id, code });
        }
        sessionOwners.delete(id);
      },
    });
    managerInitialised = true;
  }
  return manager!;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

export function handleWsTerminal(ws: WebSocket): void {
  const mgr = ensureManager();
  const ownedSessions = new Set<string>();

  // Idle timeout — reset on every incoming message.
  let idleTimer = setTimeout(() => ws.close(4000, "idle timeout"), IDLE_TIMEOUT_MS);
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => ws.close(4000, "idle timeout"), IDLE_TIMEOUT_MS);
  };

  ws.on("message", (raw) => {
    resetIdle();

    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
    } catch {
      send(ws, { type: "error", message: "invalid JSON" });
      return;
    }

    switch (msg.type) {
      case "create": {
        if (ownedSessions.size >= MAX_SESSIONS_PER_CONNECTION) {
          send(ws, {
            type: "error",
            message: `max ${MAX_SESSIONS_PER_CONNECTION} sessions per connection`,
          });
          return;
        }
        if (mgr.size >= MAX_SESSIONS_GLOBAL) {
          send(ws, {
            type: "error",
            message: `max ${MAX_SESSIONS_GLOBAL} global sessions reached`,
          });
          return;
        }

        const cwd = process.env.CLAUDE_HOME || homedir();
        const id = mgr.create({
          cwd,
          cols: msg.cols || 80,
          rows: msg.rows || 24,
        });
        ownedSessions.add(id);
        sessionOwners.set(id, ws);
        send(ws, { type: "created", id, cwd });
        break;
      }

      case "data": {
        if (!ownedSessions.has(msg.id)) return;
        mgr.write(msg.id, msg.data);
        break;
      }

      case "resize": {
        if (!ownedSessions.has(msg.id)) return;
        mgr.resize(msg.id, msg.cols, msg.rows);
        break;
      }

      case "kill": {
        if (!ownedSessions.has(msg.id)) return;
        mgr.kill(msg.id);
        ownedSessions.delete(msg.id);
        sessionOwners.delete(msg.id);
        break;
      }

      default:
        send(ws, { type: "error", message: "unknown message type" });
    }
  });

  ws.on("close", () => {
    clearTimeout(idleTimer);
    for (const id of ownedSessions) {
      mgr.kill(id);
      sessionOwners.delete(id);
    }
    ownedSessions.clear();
  });
}
