# Self-Hosting (Docker)

## Role

Run Harness Hub as a containerised web application, accessible from any browser on your network. Includes a WebSocket-based terminal that replaces the Electron-only PTY, so you get a full shell even in Docker.

## Quick Start

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) and log in with the credentials set in `docker-compose.yml`.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HARNESS_HUB_MODE` | Yes | `desktop` | Set to `web` to enable web mode (authentication, network binding) |
| `CLAUDE_HOME` | Yes (web) | — | Absolute path to the Claude Code harness directory inside the container |
| `HARNESS_HUB_AUTH_PASS` | Yes (web)* | — | Plain-text login password |
| `HARNESS_HUB_AUTH_PASS_HASH` | No | — | bcrypt hash of the password (takes precedence over plain-text) |
| `HARNESS_HUB_AUTH_USER` | No | — | Login username (informational — auth checks password only) |
| `HARNESS_HUB_AUTH` | No | — | Set to `none` to disable authentication entirely |
| `HARNESS_HUB_SHELL` | No | auto | Override the shell binary spawned in the web terminal |
| `PORT` | No | `3000` | HTTP listen port |

\* Either `HARNESS_HUB_AUTH_PASS` or `HARNESS_HUB_AUTH_PASS_HASH` must be set unless `HARNESS_HUB_AUTH=none`.

## docker-compose.yml Example

```yaml
services:
  harness-hub:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - "${HOME}/.claude:/data/.claude:rw"
    environment:
      - HARNESS_HUB_MODE=web
      - CLAUDE_HOME=/data/.claude
      - HARNESS_HUB_AUTH_USER=admin
      - HARNESS_HUB_AUTH_PASS=changeme
    restart: unless-stopped
```

## Architecture

- **server.ts** — Custom Node.js server wrapping the Next.js standalone build. Handles HTTP requests via Next.js and upgrades `/ws/terminal` to a WebSocket connection.
- **lib/terminal/ws-terminal.ts** — WebSocket message handler that manages PTY sessions via `TerminalManager`. Enforces per-connection (5) and global (20) session limits with a 30-minute idle timeout.
- **components/ws-terminal-provider.tsx** — Client-side xterm.js component that connects over WebSocket. Automatically used when `window.electronTerminal` is not available (i.e., running in a browser instead of Electron).
- **components/setup-banner.tsx** — Checks `/api/health` on mount and displays an amber banner if `CLAUDE_HOME` is missing.

## WebSocket Terminal Protocol

All messages are JSON.

**Client to Server:**
- `{ type: "create", cols, rows }` — spawn a new PTY session
- `{ type: "data", id, data }` — send keystrokes to a session
- `{ type: "resize", id, cols, rows }` — resize a session
- `{ type: "kill", id }` — terminate a session

**Server to Client:**
- `{ type: "created", id, cwd }` — session ready
- `{ type: "data", id, data }` — PTY output
- `{ type: "exit", id, code }` — session ended
- `{ type: "error", message }` — error message

## Security

- WebSocket upgrade requires a valid `__hh_session` cookie (same auth as the HTTP API).
- In desktop mode, authentication is skipped.
- The server validates `CLAUDE_HOME` and auth configuration at startup and exits immediately if misconfigured (fail-closed).

## Related Files

- `server.ts` — custom server entry point
- `lib/terminal/terminal-manager.ts` — shared PTY manager
- `lib/terminal/ws-terminal.ts` — WebSocket handler
- `components/ws-terminal-provider.tsx` — browser terminal UI
- `components/setup-banner.tsx` — environment health banner
- `components/terminal-dock.tsx` — orchestrates Electron vs WebSocket terminal
- `Dockerfile` — multi-stage Docker build
- `docker-compose.yml` — compose configuration
- `tsconfig.server.json` — TypeScript config for server.ts compilation
