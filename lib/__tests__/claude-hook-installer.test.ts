import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installHook, uninstallHook, isHookInstalled } from "../claude-hook-installer";
import { writeFile, mkdir, rm, readFile } from "fs/promises";
import path from "path";
import os from "os";

describe("claude-hook-installer", () => {
  let tmpDir: string;
  let settingsPath: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `hook-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    settingsPath = path.join(tmpDir, "settings.json");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("installs hook into empty settings", async () => {
    await writeFile(settingsPath, "{}");
    await installHook(settingsPath);
    const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
    expect(settings.hooks?.PostToolUse).toBeDefined();
    expect(settings.hooks.PostToolUse).toHaveLength(1);
    expect(settings.hooks.PostToolUse[0].matcher).toBe("Edit|Write");
    expect(settings.hooks.PostToolUse[0].hooks[0].type).toBe("http");
    expect(settings.hooks.PostToolUse[0].hooks[0].url).toContain("/api/rescan");
  });

  it("installs alongside existing hooks without mutating them", async () => {
    await writeFile(settingsPath, JSON.stringify({
      hooks: { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }] },
    }));
    await installHook(settingsPath);
    const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
    expect(settings.hooks.PostToolUse).toHaveLength(2);
    expect(settings.hooks.PostToolUse[0].matcher).toBe("Bash"); // untouched
  });

  it("is idempotent — second install is no-op", async () => {
    await writeFile(settingsPath, "{}");
    await installHook(settingsPath);
    await installHook(settingsPath);
    const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
    expect(settings.hooks.PostToolUse).toHaveLength(1);
  });

  it("uninstalls cleanly", async () => {
    await writeFile(settingsPath, "{}");
    await installHook(settingsPath);
    await uninstallHook(settingsPath);
    const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
    expect(settings.hooks.PostToolUse).toHaveLength(0);
  });

  it("uninstall leaves unrelated hooks untouched", async () => {
    await writeFile(settingsPath, JSON.stringify({
      hooks: { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }] },
    }));
    await installHook(settingsPath);
    await uninstallHook(settingsPath);
    const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
    expect(settings.hooks.PostToolUse).toHaveLength(1);
    expect(settings.hooks.PostToolUse[0].matcher).toBe("Bash");
  });

  it("isHookInstalled returns correct status", async () => {
    await writeFile(settingsPath, "{}");
    expect(await isHookInstalled(settingsPath)).toBe(false);
    await installHook(settingsPath);
    expect(await isHookInstalled(settingsPath)).toBe(true);
    await uninstallHook(settingsPath);
    expect(await isHookInstalled(settingsPath)).toBe(false);
  });

  it("installs even when settings.json does not exist", async () => {
    const newPath = path.join(tmpDir, "new-settings.json");
    await installHook(newPath);
    const settings = JSON.parse(await readFile(newPath, "utf-8"));
    expect(settings.hooks.PostToolUse).toHaveLength(1);
  });
});
