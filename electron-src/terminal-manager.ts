import { randomUUID } from "crypto";

export interface PtyLike {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(cb: (data: string) => void): { dispose(): void };
  onExit(cb: (e: { exitCode: number }) => void): { dispose(): void };
}

export interface PtyOptions {
  cwd: string;
  cols: number;
  rows: number;
}

export type PtyFactory = (options: PtyOptions) => PtyLike;

export interface TerminalManagerOptions {
  ptyFactory: PtyFactory;
  onData: (id: string, data: string) => void;
  onExit: (id: string, code: number) => void;
}

interface Session {
  pty: PtyLike;
}

export class TerminalManager {
  private sessions = new Map<string, Session>();

  constructor(private opts: TerminalManagerOptions) {}

  create(options: PtyOptions): string {
    const id = randomUUID();
    const pty = this.opts.ptyFactory(options);
    pty.onData((data) => this.opts.onData(id, data));
    pty.onExit((e) => {
      this.opts.onExit(id, e.exitCode);
      this.sessions.delete(id);
    });
    this.sessions.set(id, { pty });
    return id;
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.pty.resize(cols, rows);
  }

  kill(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.pty.kill();
    this.sessions.delete(id);
  }

  killAll(): void {
    for (const [, session] of this.sessions) {
      session.pty.kill();
    }
    this.sessions.clear();
  }
}

/**
 * Default factory that uses real node-pty. Lazy-imported so tests can avoid
 * loading the native module.
 *
 * Platform notes:
 * - We branch on `process.platform` FIRST. Git Bash for Windows can set
 *   `SHELL=/usr/bin/bash`, which would fail to spawn on native Windows.
 * - Windows default is `powershell.exe` (PS 5.1, shipped with every Windows).
 *   We intentionally do NOT read `COMSPEC` — on Windows that env var is almost
 *   always `cmd.exe`, and defaulting to cmd.exe would be a worse UX than
 *   PowerShell. Users who prefer pwsh/cmd can set `HARNESS_HUB_SHELL` in their
 *   environment (checked first on all platforms).
 * - We do NOT pass `useConpty`. Recent node-pty auto-selects ConPTY on
 *   supported Windows and falls back to winpty on older systems.
 */
export function createDefaultPtyFactory(): PtyFactory {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pty = require("node-pty");
  return (options: PtyOptions): PtyLike => {
    const override = process.env.HARNESS_HUB_SHELL;
    const shell = override
      ? override
      : process.platform === "win32"
        ? "powershell.exe"
        : (process.env.SHELL || "/bin/zsh");
    return pty.spawn(shell, [], {
      name: "xterm-256color",
      cwd: options.cwd,
      cols: options.cols,
      rows: options.rows,
      env: process.env as { [key: string]: string },
    });
  };
}
