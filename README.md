# Harness Hub

A local web dashboard for viewing and managing your Claude Code harness (plugins, skills, commands, hooks, MCP servers, settings).

## Quick Start

```bash
pnpm install
pnpm dev
```

Open http://127.0.0.1:3000

## Features

- **Dashboard** — Overview of all harness components
- **Plugins** — View installed plugins, toggle enable/disable
- **Skills** — Browse plugin and custom skills with markdown preview
- **Commands** — View custom slash commands
- **Hooks** — View configured hooks by event type, delete hooks
- **MCP Servers** — View connected MCP servers
- **Settings** — View settings.json with form UI, edit CLAUDE.md

## Tech Stack

Next.js 16, React 19, Tailwind CSS v4, Zustand, Vitest

## Environment

Set `CLAUDE_HOME` to override the default `~/.claude` path.

## Security

The dev server binds to `127.0.0.1` only (not exposed to network).
