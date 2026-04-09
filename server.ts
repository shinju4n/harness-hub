import { createServer, IncomingMessage } from "http";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { handleWsTerminal } from "./lib/terminal/ws-terminal";

// ---------------------------------------------------------------------------
// Phase 1: Env validation (fail-closed in web mode)
// ---------------------------------------------------------------------------

const mode = process.env.HARNESS_HUB_MODE || "desktop";
const isWeb = mode === "web";

if (isWeb) {
  const claudeHome = process.env.CLAUDE_HOME;
  if (!claudeHome) {
    console.error("[server] FATAL: CLAUDE_HOME must be set in web mode");
    process.exit(1);
  }

  // Auth must be configured unless explicitly opted out
  const authOff = process.env.HARNESS_HUB_AUTH === "none";
  const hasPass =
    !!process.env.HARNESS_HUB_AUTH_PASS ||
    !!process.env.HARNESS_HUB_AUTH_PASS_HASH;
  if (!authOff && !hasPass) {
    console.error(
      "[server] FATAL: HARNESS_HUB_AUTH_PASS or HARNESS_HUB_AUTH_PASS_HASH must be set in web mode (or set HARNESS_HUB_AUTH=none to disable)",
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Next.js app
// ---------------------------------------------------------------------------

const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

// ---------------------------------------------------------------------------
// Session validation for WS (mirrors lib/auth.ts logic)
// ---------------------------------------------------------------------------

/**
 * Validate the __hh_session cookie from a raw HTTP request.
 * In desktop mode, always returns true.
 * In web mode with auth=none, always returns true.
 * Otherwise, delegates to the in-memory session store.
 */
function validateWsCookie(req: IncomingMessage): boolean {
  if (!isWeb) return true;
  if (process.env.HARNESS_HUB_AUTH === "none") return true;

  const cookie = req.headers.cookie;
  if (!cookie) return false;

  const match = cookie.match(/(?:^|;\s*)__hh_session=([^;]+)/);
  if (!match) return false;

  // IMPORTANT: In standalone mode, this custom server and Next.js share the
  // same Node.js process and require cache, so the in-memory session Map in
  // lib/auth.ts is shared. However, Next.js may webpack-bundle lib/auth.ts
  // into its own chunk with a separate module scope. To guarantee the same
  // session store, we re-implement the cookie check here against the session
  // Map exported from the require'd module. If this ever breaks (sessions
  // created in API routes are invisible here), switch to a signed-cookie
  // (HMAC) approach that doesn't depend on shared in-memory state.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { validateSession } = require("./lib/auth");
  return validateSession(match[1]);
}

// ---------------------------------------------------------------------------
// Phase 3: HTTP + WebSocket server
// ---------------------------------------------------------------------------

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  // WebSocket server attached to the HTTP server, handling upgrade manually
  // so we can filter to the /ws/terminal path only.
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (pathname !== "/ws/terminal") {
      socket.destroy();
      return;
    }

    // Authenticate before completing the upgrade
    if (!validateWsCookie(req)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    handleWsTerminal(ws);
  });

  server.listen(port, hostname, () => {
    console.log(`[server] Harness Hub ready on http://${hostname}:${port} (mode=${mode})`);
  });
});
