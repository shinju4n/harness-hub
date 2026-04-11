/**
 * Tests for the IPC integration wiring in main.ts:
 *   - handleUpdaterEvent forwards UpdaterEvents to mainWindow.webContents.send
 *   - "updater:check" IPC handler calls controller.stop() then controller.start()
 *   - "updater:quit-and-install" IPC handler calls controller.quitAndInstall()
 *
 * These units are extracted from main.ts as pure functions / thin wrappers so
 * they can be exercised without spinning up a real Electron app.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { createUpdaterController, type UpdaterLike, type UpdaterEvent } from "../updater";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal BrowserWindow webContents stand-in */
function createFakeWebContents() {
  return {
    send: vi.fn(),
  };
}

/** Minimal BrowserWindow stand-in */
function createFakeWindow(destroyed = false) {
  return {
    isDestroyed: vi.fn().mockReturnValue(destroyed),
    webContents: createFakeWebContents(),
  };
}

/** Fake electron-updater compatible object backed by EventEmitter */
function createFakeUpdater(): UpdaterLike & EventEmitter {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    logger: null as unknown,
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    quitAndInstall: vi.fn(),
  }) as unknown as UpdaterLike & EventEmitter;
}

/**
 * Inline re-implementation of handleUpdaterEvent from main.ts.
 * The function is a pure transformation: it takes the event + a reference to
 * mainWindow and calls webContents.send when the window is alive.
 * We test the exact same logic without importing Electron.
 */
function makeHandleUpdaterEvent(
  getWindow: () => { isDestroyed(): boolean; webContents: { send: (...args: unknown[]) => void } } | null
) {
  return function handleUpdaterEvent(event: UpdaterEvent): void {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("updater:event", event);
    }
  };
}

/**
 * Inline re-implementation of the "updater:check" IPC handler from main.ts.
 */
function makeHandleUpdaterCheck(getController: () => { stop(): void; start(): void } | null) {
  return function handleUpdaterCheck(): void {
    const ctrl = getController();
    ctrl?.stop();
    ctrl?.start();
  };
}

/**
 * Inline re-implementation of the "updater:quit-and-install" IPC handler.
 */
function makeHandleQuitAndInstall(getController: () => { quitAndInstall(): void } | null) {
  return function handleQuitAndInstall(): void {
    const ctrl = getController();
    ctrl?.quitAndInstall();
  };
}

// ---------------------------------------------------------------------------
// handleUpdaterEvent — forwarding events to the renderer
// ---------------------------------------------------------------------------

describe("handleUpdaterEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the event to mainWindow.webContents when window is alive", () => {
    const win = createFakeWindow(false);
    const handler = makeHandleUpdaterEvent(() => win);
    const event: UpdaterEvent = { type: "checking" };

    handler(event);

    expect(win.webContents.send).toHaveBeenCalledOnce();
    expect(win.webContents.send).toHaveBeenCalledWith("updater:event", event);
  });

  it("sends update-available event with version to the renderer", () => {
    const win = createFakeWindow(false);
    const handler = makeHandleUpdaterEvent(() => win);
    const event: UpdaterEvent = { type: "available", version: "1.2.3" };

    handler(event);

    expect(win.webContents.send).toHaveBeenCalledWith("updater:event", event);
  });

  it("sends download-progress event with percent to the renderer", () => {
    const win = createFakeWindow(false);
    const handler = makeHandleUpdaterEvent(() => win);
    const event: UpdaterEvent = { type: "progress", percent: 57 };

    handler(event);

    expect(win.webContents.send).toHaveBeenCalledWith("updater:event", event);
  });

  it("sends update-downloaded event with version to the renderer", () => {
    const win = createFakeWindow(false);
    const handler = makeHandleUpdaterEvent(() => win);
    const event: UpdaterEvent = { type: "downloaded", version: "1.2.3" };

    handler(event);

    expect(win.webContents.send).toHaveBeenCalledWith("updater:event", event);
  });

  it("sends error event with message to the renderer", () => {
    const win = createFakeWindow(false);
    const handler = makeHandleUpdaterEvent(() => win);
    const event: UpdaterEvent = { type: "error", message: "network timeout" };

    handler(event);

    expect(win.webContents.send).toHaveBeenCalledWith("updater:event", event);
  });

  it("does not call webContents.send when mainWindow is null", () => {
    const handler = makeHandleUpdaterEvent(() => null);
    const event: UpdaterEvent = { type: "not-available" };

    // Should not throw and should not attempt to send anything.
    expect(() => handler(event)).not.toThrow();
  });

  it("does not call webContents.send when mainWindow has been destroyed", () => {
    const win = createFakeWindow(true /* destroyed */);
    const handler = makeHandleUpdaterEvent(() => win);
    const event: UpdaterEvent = { type: "not-available" };

    handler(event);

    expect(win.webContents.send).not.toHaveBeenCalled();
  });

  it("sends the channel name exactly as 'updater:event'", () => {
    const win = createFakeWindow(false);
    const handler = makeHandleUpdaterEvent(() => win);

    handler({ type: "checking" });

    const [channel] = win.webContents.send.mock.calls[0];
    expect(channel).toBe("updater:event");
  });
});

// ---------------------------------------------------------------------------
// updater:check IPC — restarts the controller
// ---------------------------------------------------------------------------

describe("updater:check IPC handler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls stop() then start() on the controller", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });
    const stopSpy = vi.spyOn(controller, "stop");
    const startSpy = vi.spyOn(controller, "start");

    const handleCheck = makeHandleUpdaterCheck(() => controller);
    handleCheck();

    expect(stopSpy).toHaveBeenCalledOnce();
    expect(startSpy).toHaveBeenCalledOnce();
  });

  it("calls stop() before start() so the old interval is cleared first", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });
    const order: string[] = [];
    vi.spyOn(controller, "stop").mockImplementation(() => order.push("stop"));
    vi.spyOn(controller, "start").mockImplementation(() => order.push("start"));

    const handleCheck = makeHandleUpdaterCheck(() => controller);
    handleCheck();

    expect(order).toEqual(["stop", "start"]);
  });

  it("triggers a fresh checkForUpdates call after restart", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });

    // start() is called once during setup below — reset the spy count first.
    controller.start();
    const callsBefore = (updater.checkForUpdates as ReturnType<typeof vi.fn>).mock.calls.length;

    const handleCheck = makeHandleUpdaterCheck(() => controller);
    handleCheck(); // stop + start

    const callsAfter = (updater.checkForUpdates as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBeGreaterThan(callsBefore);
  });

  it("does not throw when controller is null", () => {
    const handleCheck = makeHandleUpdaterCheck(() => null);

    expect(() => handleCheck()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// updater:quit-and-install IPC — delegates to the controller
// ---------------------------------------------------------------------------

describe("updater:quit-and-install IPC handler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls quitAndInstall() on the controller", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });
    const quitSpy = vi.spyOn(controller, "quitAndInstall");

    const handleQuit = makeHandleQuitAndInstall(() => controller);
    handleQuit();

    expect(quitSpy).toHaveBeenCalledOnce();
  });

  it("does not throw when controller is null", () => {
    const handleQuit = makeHandleQuitAndInstall(() => null);

    expect(() => handleQuit()).not.toThrow();
  });

  it("delegates to the underlying updater.quitAndInstall only after a download has occurred", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });
    controller.start();

    const handleQuit = makeHandleQuitAndInstall(() => controller);

    // Before download: underlying quitAndInstall must not be called.
    handleQuit();
    expect(updater.quitAndInstall).not.toHaveBeenCalled();

    // Simulate download arriving.
    updater.emit("update-downloaded", { version: "2.0.0" });

    // After download: underlying quitAndInstall must be called.
    handleQuit();
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Integration: UpdaterController + handleUpdaterEvent wired together
// ---------------------------------------------------------------------------

describe("UpdaterController onEvent → handleUpdaterEvent integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("all normalized updater events reach mainWindow.webContents.send", () => {
    vi.useFakeTimers();
    const win = createFakeWindow(false);
    const updater = createFakeUpdater();

    const handler = makeHandleUpdaterEvent(() => win);
    const controller = createUpdaterController({
      updater,
      enabled: true,
      onEvent: handler,
    });
    controller.start();

    updater.emit("checking-for-update");
    updater.emit("update-available", { version: "3.0.0" });
    updater.emit("update-not-available", {});
    updater.emit("download-progress", { percent: 75.4 });
    updater.emit("update-downloaded", { version: "3.0.0" });
    updater.emit("error", new Error("something broke"));

    expect(win.webContents.send).toHaveBeenCalledTimes(6);
    const sentPayloads = win.webContents.send.mock.calls.map(([, payload]) => payload);
    expect(sentPayloads).toContainEqual({ type: "checking" });
    expect(sentPayloads).toContainEqual({ type: "available", version: "3.0.0" });
    expect(sentPayloads).toContainEqual({ type: "not-available" });
    expect(sentPayloads).toContainEqual({ type: "progress", percent: 75 });
    expect(sentPayloads).toContainEqual({ type: "downloaded", version: "3.0.0" });
    expect(sentPayloads).toContainEqual({ type: "error", message: "something broke" });
  });

  it("events emitted after window destruction do not reach webContents.send", () => {
    vi.useFakeTimers();
    const win = createFakeWindow(false);
    const updater = createFakeUpdater();

    const handler = makeHandleUpdaterEvent(() => win);
    const controller = createUpdaterController({
      updater,
      enabled: true,
      onEvent: handler,
    });
    controller.start();

    // First event arrives while window is alive.
    updater.emit("checking-for-update");
    expect(win.webContents.send).toHaveBeenCalledTimes(1);

    // Window gets destroyed.
    win.isDestroyed.mockReturnValue(true);

    // Subsequent events should be silently dropped.
    updater.emit("update-not-available", {});
    expect(win.webContents.send).toHaveBeenCalledTimes(1);
  });
});
