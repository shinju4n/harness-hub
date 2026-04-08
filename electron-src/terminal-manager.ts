import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { homedir } from "os";

export interface PtyLike {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(cb: (data: string) => void): { dispose(): void };
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): { dispose(): void };
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
    const isWin = process.platform === "win32";
    const shell = override
      ? override
      : isWin
        ? "powershell.exe"
        : (process.env.SHELL || "/bin/zsh");

    // Validate cwd. If it doesn't exist, fall back to home to avoid a
    // posix_spawn ENOENT or a shell that immediately exits with code 1.
    // Load-bearing: resolveClaudeHome in cwd-resolver.ts does NOT verify the
    // profile path exists on disk, so stale profiles end up here.
    let cwd = options.cwd;
    if (!cwd || !existsSync(cwd)) {
      console.warn(`[terminal] cwd "${cwd}" missing — falling back to home`);
      cwd = homedir();
    }

    // node-pty's native binding chokes on undefined env values. Electron's
    // process.env can legally contain non-string values; filter to strings.
    const env: { [key: string]: string } = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === "string") env[k] = v;
    }
    // Ensure the shell has the minimum it needs to start a usable session.
    // `C.UTF-8` is universally present on glibc; `en_US.UTF-8` may not be
    // generated on minimal Linux containers and would cause zsh to complain.
    if (!env.TERM) env.TERM = "xterm-256color";
    if (!env.HOME) env.HOME = homedir();
    if (!env.LANG) env.LANG = "C.UTF-8";

    // On macOS/Linux, launch as a login shell so .zprofile/.bash_profile are
    // sourced — matches what VS Code's integrated terminal does and ensures
    // PATH / NVM / asdf / rbenv etc. are loaded. Without -l, many zsh setups
    // that rely on login-time initialization exit with code 1.
    const args = isWin ? [] : ["-l"];

    return pty.spawn(shell, args, {
      name: "xterm-256color",
      cwd,
      cols: options.cols,
      rows: options.rows,
      env,
    });
  };
}
