# Harness Hub

A desktop dashboard for viewing and managing your Claude Code harness (plugins, skills, commands, hooks, MCP servers, settings).

## Quick Start

### Desktop App (Electron)

```bash
pnpm install
pnpm electron:dev
```

### Web (Browser)

```bash
pnpm install
pnpm dev
```

Open http://127.0.0.1:3000

## Features

- **Dashboard** — Overview of all harness components
- **Plugins** — View installed plugins, toggle enable/disable
- **Skills** — Browse plugin and custom skills with markdown preview and inline editing
- **Commands** — View and edit custom slash commands
- **Hooks** — View configured hooks by event type, delete hooks
- **MCP Servers** — View connected MCP servers
- **Settings** — View settings.json with form UI, edit CLAUDE.md

## Building for Distribution

### macOS (.dmg)

```bash
pnpm electron:build:mac
```

Output: `dist-electron/Harness Hub-0.1.0-arm64.dmg` (Apple Silicon) and `dist-electron/Harness Hub-0.1.0.dmg` (Intel)

### Windows (.exe)

```bash
pnpm electron:build:win
```

Output: `dist-electron/Harness Hub Setup 0.1.0.exe`

## Tech Stack

Next.js 16, React 19, Tailwind CSS v4, Zustand, Electron, Vitest

## Environment

Set `CLAUDE_HOME` to override the default `~/.claude` path.

## Security

- Server binds to `127.0.0.1` only (not exposed to network)
- Electron: `nodeIntegration` disabled, `contextIsolation` enabled

## License

MIT
