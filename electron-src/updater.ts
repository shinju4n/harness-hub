// Testable wrapper around electron-updater. The real AppUpdater instance is
// injected so unit tests can swap in a fake EventEmitter-based stub without
// pulling Electron into the node test environment.

export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  logger: unknown;
  /**
   * electron-updater returns `Promise<UpdateCheckResult | null>` — null when
   * the updater has been cancelled or is not configured. We accept the `null`
   * case so callers can `checkForUpdates().catch(...)` safely only when the
   * result is actually a promise.
   */
  checkForUpdates(): Promise<unknown> | null;
  quitAndInstall?: () => void;
  on(event: string, listener: (...args: unknown[]) => void): this;
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
  let downloaded = false;

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
      downloaded = true;
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
      // checkForUpdates may return null when the updater is disabled; only
      // attach a rejection handler if the return value is actually a promise.
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
      // Prevent the poll timer from keeping the Node/Electron event loop
      // alive during shutdown. Some environments (JSDOM, browsers) do not
      // implement unref; guard accordingly.
      (timer as unknown as { unref?: () => void }).unref?.();
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },

    quitAndInstall() {
      // Only safe after update-downloaded has fired; electron-updater will
      // otherwise throw, and we don't want a misbehaving IPC caller to bring
      // the main process down.
      if (!downloaded) return;
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
