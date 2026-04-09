<p align="center">
  <h1 align="center">Harness Hub</h1>
  <p align="center">
    A desktop dashboard for viewing and managing your Claude Code harness.
    <br />
    Plugins, skills, commands, hooks, MCP servers, settings — all in one place.
  </p>
</p>

<p align="center">
  <a href="#features">Features</a> &nbsp;&bull;&nbsp;
  <a href="#getting-started">Getting Started</a> &nbsp;&bull;&nbsp;
  <a href="#building">Building</a> &nbsp;&bull;&nbsp;
  <a href="#tech-stack">Tech Stack</a>
</p>

---

## Features

| Page | Description | Docs |
|------|-------------|------|
| **Dashboard** | Overview cards showing counts for all harness components | [docs](docs/features/dashboard.md) |
| **Harness Score** | Rule-based audit of agents/skills/hooks/permissions/CLAUDE.md against Claude Code best practices | [docs](docs/features/harness-score.md) |
| **Plugins** | View installed plugins with version info, toggle enable/disable | [docs](docs/features/plugins.md) |
| **Skills** | Browse plugin and custom skills with rendered markdown preview, inline editing | [docs](docs/features/skills.md) |
| **Commands** | View and edit custom slash commands with markdown preview | [docs](docs/features/commands.md) |
| **Hooks** | View hooks grouped by event type, delete individual hooks | [docs](docs/features/hooks.md) |
| **MCP Servers** | View connected MCP server configurations | [docs](docs/features/mcp.md) |
| **Agents** | View/edit agent definitions, browse team inbox messages | [docs](docs/features/agents.md) |
| **Rules** | View/edit conditional rules for path-scoped instructions | [docs](docs/features/rules.md) |
| **Memory** | Browse/edit/create/delete auto memory across all projects | [docs](docs/features/memory.md) |
| **Sessions** | View current and recent Claude Code sessions with pid/cwd/startedAt | [docs](docs/features/sessions.md) |
| **Plans** | Browse plan mode documents from `~/.claude/plans/` with markdown preview | [docs](docs/features/plans.md) |
| **History** | Paginated view of `history.jsonl` with project/date filters | [docs](docs/features/history.md) |
| **Images** | Gallery of every image attached to a Claude Code conversation, with lightbox + project filter | [docs](docs/features/images.md) |
| **Keybindings** | View/edit custom keyboard shortcuts | [docs](docs/features/keybindings.md) |
| **CLAUDE.md** | Edit user instructions across User / Project / Local / Organization scopes with live preview | [docs](docs/features/claude-md.md) |
| **Settings** | Edit `settings.json` via form UI | [docs](docs/features/settings.md) |
| **Profiles** | Switch between multiple `~/.claude` paths (external drives, NAS, cloud sync all welcome) | [docs](docs/features/profiles.md) |
| **Terminal** | Bottom-docked shell panel (xterm.js + node-pty), per-page auto cwd, `Ctrl+\`` toggle | [docs](docs/features/terminal.md) |
| **Toast Notifications** | Global success/error/info toasts wired into all mutation call sites | [docs](docs/features/toast-notifications.md) |
| **Command Palette** | Cmd+K global search across pages, agents, plans, hook scripts, and sessions | [docs](docs/features/command-palette.md) |
| **Version History** | Browsable, diffable, restorable snapshots of every Skills and Agents edit — from harness-hub, Claude Code, or external tools | [docs](docs/features/version-history.md) |
| **Web Auth** | Session-based authentication middleware for web mode with CSRF protection and login UI | [docs](docs/features/web-auth.md) |
| **Self-Hosting** | Docker deployment with WebSocket terminal, environment validation, and session auth | [docs](docs/features/self-hosting.md) |

### Highlights

- Reads directly from `~/.claude/` — no setup required
- Responsive design — works on any screen size
- Markdown rendered with syntax highlighting, tables, and code blocks
- Inline editing for custom skills, commands, and CLAUDE.md
- Safe file writes with mtime conflict detection and automatic backups
- Available as a desktop app (Electron) or in the browser

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 9+
- [Claude Code](https://claude.ai/code) installed (`~/.claude/` directory exists)

### Desktop App (Electron)

```bash
git clone https://github.com/shinju4n/harness-hub.git
cd harness-hub
pnpm install
pnpm electron:dev
```

### Web (Browser)

```bash
pnpm install
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Self-Hosting (Docker)

```bash
git clone https://github.com/shinju4n/harness-hub.git
cd harness-hub
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) and log in (default: `admin` / `changeme`).

See [docs/features/self-hosting.md](docs/features/self-hosting.md) for environment variables and configuration.

## Install from Release

Download the latest release from [GitHub Releases](https://github.com/shinju4n/harness-hub/releases).

Once installed, Harness Hub checks GitHub for updates on launch and every hour
while running. New versions are downloaded in the background and applied the
next time you quit the app — no manual reinstall needed.

### macOS

The macOS build is signed and notarized with an Apple Developer ID, so the
system will open it without warnings.

### Windows

The Windows build is **not code-signed** (to keep costs down), so on first
install Windows SmartScreen will show a blue **"Windows protected your PC"**
screen. Click **"More info" → "Run anyway"** to continue. This only happens
once per machine — subsequent auto-updates apply silently.

## Building

### macOS (.dmg)

```bash
pnpm electron:build:mac
```

Outputs:
- `dist-electron/Harness Hub-{version}-arm64.dmg` (Apple Silicon)
- `dist-electron/Harness Hub-{version}.dmg` (Intel)

### Windows (.exe)

```bash
pnpm electron:build:win
```

Output: `dist-electron/Harness Hub Setup {version}.exe`

## Project Structure

```
harness-hub/
├── app/                    # Next.js pages (App Router)
│   ├── page.tsx            # Dashboard
│   ├── plugins/            # Plugins page
│   ├── skills/             # Skills page
│   ├── commands/           # Commands page
│   ├── hooks/              # Hooks page
│   ├── mcp/                # MCP servers page
│   ├── settings/           # Settings page
│   └── api/                # API routes (file system access)
├── components/             # Shared UI components
│   ├── sidebar.tsx         # Navigation sidebar (responsive)
│   ├── summary-card.tsx    # Dashboard cards
│   ├── markdown-viewer.tsx # Markdown renderer with edit mode
│   ├── data-table.tsx      # Generic table component
│   └── json-form.tsx       # JSON editor form
├── lib/                    # Core utilities
│   ├── claude-home.ts      # ~/.claude path detection
│   ├── file-ops.ts         # Atomic file read/write
│   └── config-reader.ts    # Harness config parser
├── stores/                 # Zustand state management
├── electron-src/           # Electron main process source
│   ├── main.ts             # App lifecycle, window management
│   ├── preload.ts          # Security preload script
│   └── server-utils.ts     # Port finder, server readiness
└── electron-builder.yml    # Desktop packaging config
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOME` | `~/.claude` | Override the Claude Code harness directory path |

The app auto-detects `~/.claude` on macOS, Linux, and Windows.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| State | Zustand |
| Markdown | react-markdown, remark-gfm, @tailwindcss/typography |
| Desktop | Electron 41 |
| Packaging | electron-builder |
| Testing | Vitest |
| Language | TypeScript 5 |

## Security

- Next.js server binds to `127.0.0.1` only (not exposed to network)
- Electron: `nodeIntegration` disabled, `contextIsolation` enabled
- File writes use mtime conflict detection to prevent data loss
- JSON writes are atomic (temp file + rename) with automatic backups

## Development

```bash
# Run tests
pnpm vitest run --config vitest.config.node.mts

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint

# Build (Next.js only)
pnpm build
```

## License

[MIT](LICENSE)
