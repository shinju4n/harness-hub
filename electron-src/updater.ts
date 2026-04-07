// Testable wrapper around electron-updater. The real AppUpdater instance is
// injected so unit tests can swap in a fake EventEmitter-based stub without
// pulling Electron into the node test environment.

export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  logger: unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall?: () => void;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
}

export type UpdaterEvent =
  | { type: "checking" }
  | { type: "available"; version: string }
  | { type: "not-available" }
  | { type: "progress"; percent: number }
  | { type: "downloaded"; version: string }
  | { type: "error"; message: string };

export interface UpdaterControllerOptions {
  updater: UpdaterLike;
  /** When false, the controller becomes a no-op. Use app.isPackaged as the gate. */
  enabled?: boolean;
  /** Poll interval for re-checks after the initial probe. Default: 1 hour. */
  intervalMs?: number;
  /** Receives normalized events so callers (main.ts, IPC bridge) can react. */
  onEvent?: (event: UpdaterEvent) => void;
  /** Logger forwarded to the updater (electron-log instance in production). */
  logger?: unknown;
}

export interface UpdaterController {
  start(): void;
  stop(): void;
  quitAndInstall(): void;
}

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function createUpdaterController(opts: UpdaterControllerOptions): UpdaterController {
  const { updater, enabled = true, intervalMs = DEFAULT_INTERVAL_MS, onEvent, logger } = opts;

  let timer: ReturnType<typeof setInterval> | null = null;
  let wired = false;

  const emit = (event: UpdaterEvent) => {
    try {
      onEvent?.(event);
    } catch {
      // Never let a consumer callback crash the updater.
    }
  };

  const wireEvents = () => {
    if (wired) return;
    wired = true;

    updater.on("checking-for-update", () => emit({ type: "checking" }));
    updater.on("update-available", (info: unknown) => {
      const version = extractVersion(info);
      emit({ type: "available", version });
    });
    updater.on("update-not-available", () => emit({ type: "not-available" }));
    updater.on("download-progress", (info: unknown) => {
      const raw = (info as { percent?: number } | undefined)?.percent ?? 0;
      emit({ type: "progress", percent: Math.round(raw) });
    });
    updater.on("update-downloaded", (info: unknown) => {
      const version = extractVersion(info);
      emit({ type: "downloaded", version });
    });
    updater.on("error", (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err ?? "Unknown error");
      emit({ type: "error", message });
    });
  };

  const probe = () => {
    try {
      const maybe = updater.checkForUpdates();
      // checkForUpdates returns a Promise; attach rejection handler so unhandled
      // promise rejections don't crash the main process.
      if (maybe && typeof (maybe as Promise<unknown>).catch === "function") {
        (maybe as Promise<unknown>).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          emit({ type: "error", message });
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit({ type: "error", message });
    }
  };

  return {
    start() {
      if (!enabled) return;

      updater.autoDownload = true;
      updater.autoInstallOnAppQuit = true;
      if (logger !== undefined) {
        updater.logger = logger;
      }

      wireEvents();
      probe();

      if (timer) clearInterval(timer);
      timer = setInterval(probe, intervalMs);
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },

    quitAndInstall() {
      updater.quitAndInstall?.();
    },
  };
}

function extractVersion(info: unknown): string {
  if (info && typeof info === "object" && "version" in info) {
    const v = (info as { version?: unknown }).version;
    if (typeof v === "string") return v;
  }
  return "";
}
