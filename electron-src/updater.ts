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
  /**
   * Required so stop() can tear down subscribed listeners deterministically.
   * Node's EventEmitter has implemented `off` since Node 10, and the real
   * electron-updater AppUpdater inherits from EventEmitter, so any realistic
   * adapter satisfies this without effort.
   */
  off(event: string, listener: (...args: unknown[]) => void): this;
}

export type UpdaterEvent =
  | { type: "checking" }
  | { type: "available"; version: string }
  | { type: "not-available" }
  | { type: "progress"; percent: number }
  | { type: "downloaded"; version: string }
  | { type: "error"; message: string };

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdaterState {
  status: UpdaterStatus;
  version?: string;
  percent?: number;
  message?: string;
}

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
  /** Trigger a fresh probe without tearing down wired listeners or losing downloaded state. */
  recheck(): void;
  quitAndInstall(): void;
  /** Snapshot of the latest known state — used to rehydrate UI on mount. */
  getState(): UpdaterState;
}

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function createUpdaterController(opts: UpdaterControllerOptions): UpdaterController {
  const { updater, enabled = true, intervalMs = DEFAULT_INTERVAL_MS, onEvent, logger } = opts;

  let timer: ReturnType<typeof setInterval> | null = null;
  let wired = false;
  let state: UpdaterState = { status: "idle" };
  // Listener handles captured so stop() can tear them down cleanly and
  // subsequent start() calls do not accumulate duplicates.
  const registeredListeners: Array<{ event: string; listener: (...args: unknown[]) => void }> = [];

  const setState = (next: UpdaterState) => {
    state = next;
  };

  const emit = (event: UpdaterEvent) => {
    // Update our internal snapshot BEFORE notifying consumers so that if the
    // onEvent callback calls getState() synchronously, it sees consistent data.
    switch (event.type) {
      case "checking":
        // Preserve downloaded state across rechecks — the user might click
        // "Check now" while already holding a downloaded installer. We still
        // reflect "checking" back to the UI, but the downloaded flag is kept
        // via the downloadedVersion closure below.
        setState({ ...state, status: "checking" });
        break;
      case "available":
        setState({ status: "available", version: event.version });
        break;
      case "not-available":
        // If a previous cycle downloaded a newer version, keep that state
        // rather than pretending we're idle.
        if (downloadedVersion) {
          setState({ status: "downloaded", version: downloadedVersion });
        } else {
          setState({ status: "idle" });
        }
        break;
      case "progress":
        setState({
          status: "downloading",
          version: state.version,
          percent: event.percent,
        });
        break;
      case "downloaded":
        downloadedVersion = event.version;
        setState({ status: "downloaded", version: event.version });
        break;
      case "error":
        setState({ status: "error", message: event.message });
        break;
    }
    try {
      onEvent?.(event);
    } catch {
      // Never let a consumer callback crash the updater.
    }
  };

  // Tracked OUTSIDE the state object so rechecks (which transition state to
  // "checking") don't wipe it — quitAndInstall() still needs to know whether
  // a download actually completed.
  let downloadedVersion: string | null = null;

  const subscribe = (event: string, listener: (...args: unknown[]) => void) => {
    updater.on(event, listener);
    registeredListeners.push({ event, listener });
  };

  const wireEvents = () => {
    if (wired) return;
    wired = true;

    subscribe("checking-for-update", () => emit({ type: "checking" }));
    subscribe("update-available", (info: unknown) => {
      const version = extractVersion(info);
      emit({ type: "available", version });
    });
    subscribe("update-not-available", () => emit({ type: "not-available" }));
    subscribe("download-progress", (info: unknown) => {
      const raw = (info as { percent?: number } | undefined)?.percent ?? 0;
      emit({ type: "progress", percent: Math.round(raw) });
    });
    subscribe("update-downloaded", (info: unknown) => {
      const version = extractVersion(info);
      emit({ type: "downloaded", version });
    });
    subscribe("error", (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err ?? "Unknown error");
      emit({ type: "error", message });
    });
  };

  const unwireEvents = () => {
    if (!wired) return;
    for (const { event, listener } of registeredListeners) {
      updater.off(event, listener);
    }
    registeredListeners.length = 0;
    wired = false;
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
      // alive during shutdown. Node's Timeout has `.unref()` natively; some
      // test/browser shims may not, so guard accordingly.
      const nodeTimer = timer as Partial<NodeJS.Timeout>;
      if (typeof nodeTimer.unref === "function") nodeTimer.unref();
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      downloadedVersion = null;
      setState({ status: "idle" });
      unwireEvents();
    },

    recheck() {
      if (!enabled) return;
      wireEvents();
      probe();
    },

    quitAndInstall() {
      // Only safe after update-downloaded has fired; electron-updater will
      // otherwise throw, and we don't want a misbehaving IPC caller to bring
      // the main process down.
      if (!downloadedVersion) return;
      updater.quitAndInstall?.();
    },

    getState() {
      return state;
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
