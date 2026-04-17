import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { createUpdaterController, type UpdaterLike, type UpdaterEvent } from "../updater";

// Build a fake electron-updater-compatible object backed by EventEmitter.
function createFakeUpdater(): UpdaterLike & EventEmitter {
  const emitter = new EventEmitter();
  // Give the real EventEmitter's on() the correct `this` return type.
  const fake = Object.assign(emitter, {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    logger: null as unknown,
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    quitAndInstall: vi.fn(),
  }) as unknown as UpdaterLike & EventEmitter;
  return fake;
}

describe("createUpdaterController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not touch the updater when enabled=false", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: false });

    controller.start();

    expect(updater.checkForUpdates).not.toHaveBeenCalled();
    expect(updater.autoDownload).toBe(false);
  });

  it("configures autoDownload + autoInstallOnAppQuit on start", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });

    controller.start();

    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);
  });

  it("calls checkForUpdates immediately on start", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });

    controller.start();

    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it("re-checks on the configured interval", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({
      updater,
      enabled: true,
      intervalMs: 60_000,
    });

    controller.start();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(60_000);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(3);
  });

  it("stop() clears the interval and further ticks do not fire checkForUpdates", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({
      updater,
      enabled: true,
      intervalMs: 30_000,
    });

    controller.start();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    controller.stop();
    vi.advanceTimersByTime(30_000);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it("normalizes checking-for-update into a 'checking' UpdaterEvent", () => {
    const events: UpdaterEvent[] = [];
    const updater = createFakeUpdater();
    const controller = createUpdaterController({
      updater,
      enabled: true,
      onEvent: (e) => events.push(e),
    });
    controller.start();

    updater.emit("checking-for-update");

    expect(events).toContainEqual({ type: "checking" });
  });

  it("normalizes update-available with version", () => {
    const events: UpdaterEvent[] = [];
    const updater = createFakeUpdater();
    const controller = createUpdaterController({
      updater,
      enabled: true,
      onEvent: (e) => events.push(e),
    });
    controller.start();

    updater.emit("update-available", { version: "0.6.0" });

    expect(events).toContainEqual({ type: "available", version: "0.6.0" });
  });

  it("normalizes update-not-available", () => {
    const events: UpdaterEvent[] = [];
    const updater = createFakeUpdater();
    const controller = createUpdaterController({
      updater,
      enabled: true,
      onEvent: (e) => events.push(e),
    });
    controller.start();

    updater.emit("update-not-available", {});

    expect(events).toContainEqual({ type: "not-available" });
  });

  it("normalizes download-progress into percent rounded to integer", () => {
    const events: UpdaterEvent[] = [];
    const updater = createFakeUpdater();
    const controller = createUpdaterController({
      updater,
      enabled: true,
      onEvent: (e) => events.push(e),
    });
    controller.start();

    updater.emit("download-progress", { percent: 42.7 });

    expect(events).toContainEqual({ type: "progress", percent: 43 });
  });

  it("normalizes update-downloaded with version", () => {
    const events: UpdaterEvent[] = [];
    const updater = createFakeUpdater();
    const controller = createUpdaterController({
      updater,
      enabled: true,
      onEvent: (e) => events.push(e),
    });
    controller.start();

    updater.emit("update-downloaded", { version: "0.6.0" });

    expect(events).toContainEqual({ type: "downloaded", version: "0.6.0" });
  });

  it("normalizes error events using Error.message", () => {
    const events: UpdaterEvent[] = [];
    const updater = createFakeUpdater();
    const controller = createUpdaterController({
      updater,
      enabled: true,
      onEvent: (e) => events.push(e),
    });
    controller.start();

    updater.emit("error", new Error("boom"));

    expect(events).toContainEqual({ type: "error", message: "boom" });
  });

  it("swallows synchronous errors from checkForUpdates so start() does not throw", () => {
    const updater = createFakeUpdater();
    updater.checkForUpdates = vi.fn().mockRejectedValue(new Error("network down"));
    const events: UpdaterEvent[] = [];
    const controller = createUpdaterController({
      updater,
      enabled: true,
      onEvent: (e) => events.push(e),
    });

    expect(() => controller.start()).not.toThrow();
  });

  it("quitAndInstall() is a no-op before update-downloaded has fired", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });
    controller.start();

    controller.quitAndInstall();

    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it("quitAndInstall() delegates to the updater only after the downloaded event", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });
    controller.start();

    updater.emit("update-downloaded", { version: "0.7.0" });
    controller.quitAndInstall();

    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it("resets the downloaded flag when stop() is called so a stale quitAndInstall cannot fire after restart", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });
    controller.start();
    updater.emit("update-downloaded", { version: "0.7.0" });

    controller.stop();
    controller.start();

    // After restart without a fresh download event, quitAndInstall must not fire.
    controller.quitAndInstall();
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it("does not accumulate duplicate listeners across start/stop cycles", () => {
    const updater = createFakeUpdater();
    const events: UpdaterEvent[] = [];
    const controller = createUpdaterController({
      updater,
      enabled: true,
      onEvent: (e) => events.push(e),
    });

    controller.start();
    controller.stop();
    controller.start();
    controller.stop();
    controller.start();

    updater.emit("update-not-available", {});

    const notAvail = events.filter((e) => e.type === "not-available");
    expect(notAvail).toHaveLength(1);
  });

  it("calls timer.unref when available so the interval does not keep the event loop alive", () => {
    const updater = createFakeUpdater();
    const unrefSpy = vi.fn();
    const originalSetInterval = globalThis.setInterval;
    const mockSetInterval = vi.fn((cb: () => void, ms: number) => {
      const handle = originalSetInterval(cb, ms);
      (handle as unknown as { unref: () => void }).unref = unrefSpy;
      return handle;
    });
    vi.stubGlobal("setInterval", mockSetInterval);

    const controller = createUpdaterController({ updater, enabled: true, intervalMs: 1000 });
    controller.start();

    expect(unrefSpy).toHaveBeenCalled();
    controller.stop();
    vi.unstubAllGlobals();
  });

  it("defaults intervalMs to 1 hour when not specified", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });

    controller.start();
    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it("recheck() probes again without tearing down listeners", () => {
    const updater = createFakeUpdater();
    const events: UpdaterEvent[] = [];
    const controller = createUpdaterController({
      updater,
      enabled: true,
      onEvent: (e) => events.push(e),
    });
    controller.start();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    controller.recheck();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);

    updater.emit("update-not-available", {});
    const notAvail = events.filter((e) => e.type === "not-available");
    expect(notAvail).toHaveLength(1);
  });

  it("recheck() preserves downloaded state so Restart & Install still works afterwards", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });
    controller.start();
    updater.emit("update-downloaded", { version: "0.7.0" });

    controller.recheck();
    // A later not-available event should NOT wipe the downloaded flag —
    // the renderer must still be able to trigger quitAndInstall.
    updater.emit("update-not-available", {});
    controller.quitAndInstall();

    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it("recheck() is a no-op when enabled=false", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: false });

    controller.recheck();

    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it("getState() returns idle before start", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });

    expect(controller.getState()).toEqual({ status: "idle" });
  });

  it("getState() tracks lifecycle transitions", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });
    controller.start();

    updater.emit("checking-for-update");
    expect(controller.getState().status).toBe("checking");

    updater.emit("update-available", { version: "0.8.0" });
    expect(controller.getState()).toEqual({ status: "available", version: "0.8.0" });

    updater.emit("download-progress", { percent: 25 });
    expect(controller.getState()).toEqual({ status: "downloading", version: "0.8.0", percent: 25 });

    updater.emit("update-downloaded", { version: "0.8.0" });
    expect(controller.getState()).toEqual({ status: "downloaded", version: "0.8.0" });
  });

  it("getState() after not-available with no prior download shows idle", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });
    controller.start();

    updater.emit("update-not-available", {});

    expect(controller.getState()).toEqual({ status: "idle" });
  });

  it("getState() preserves downloaded status across a recheck cycle", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });
    controller.start();
    updater.emit("update-downloaded", { version: "0.9.0" });

    controller.recheck();
    updater.emit("checking-for-update");
    updater.emit("update-not-available", {});

    expect(controller.getState()).toEqual({ status: "downloaded", version: "0.9.0" });
  });

  it("stop() resets state to idle", () => {
    const updater = createFakeUpdater();
    const controller = createUpdaterController({ updater, enabled: true });
    controller.start();
    updater.emit("update-downloaded", { version: "0.9.0" });

    controller.stop();

    expect(controller.getState()).toEqual({ status: "idle" });
  });
});
