import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFullConfig } from "../config-reader";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";

describe("readFullConfig", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `harness-hub-config-${Date.now()}`);
    await mkdir(path.join(tmpDir, "plugins", "cache"), { recursive: true });
    await mkdir(path.join(tmpDir, "skills"), { recursive: true });
    await mkdir(path.join(tmpDir, "commands"), { recursive: true });

    await writeFile(
      path.join(tmpDir, "settings.json"),
      JSON.stringify({
        enabledPlugins: { "test@test-plugin": true },
        hooks: {},
      })
    );
    await writeFile(
      path.join(tmpDir, "plugins", "installed_plugins.json"),
      JSON.stringify({ version: 2, plugins: {} })
    );
    await writeFile(path.join(tmpDir, ".mcp.json"), JSON.stringify({ mcpServers: {} }));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns summary counts for all categories", async () => {
    const config = await readFullConfig(tmpDir);
    expect(config.plugins).toBeDefined();
    expect(config.skills).toBeDefined();
    expect(config.commands).toBeDefined();
    expect(config.hooks).toBeDefined();
    expect(config.mcpServers).toBeDefined();
  });
});
