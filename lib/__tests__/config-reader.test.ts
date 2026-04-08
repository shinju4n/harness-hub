import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFullConfig } from "../config-reader";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";

describe("readFullConfig", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `harness-hub-config-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

describe("readFullConfig - skills", () => {
  let tmpDir: string;

  async function createSkill(marketplace: string, plugin: string, version: string, skill: string) {
    const skillDir = path.join(tmpDir, "plugins", "cache", marketplace, plugin, version, "skills", skill);
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${skill}\n---\n# ${skill}`);
  }

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `harness-hub-skills-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(path.join(tmpDir, "plugins", "cache"), { recursive: true });
    await mkdir(path.join(tmpDir, "skills"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "settings.json"),
      JSON.stringify({ enabledPlugins: {}, hooks: {} })
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

  it("(a) groups multiple single-skill plugins under one marketplace", async () => {
    await createSkill("ai-registry", "figma-analyzer", "1.0.0", "figma-analyzer");
    await createSkill("ai-registry", "ideation", "1.0.0", "ideation");
    await createSkill("ai-registry", "skill-test", "1.0.0", "skill-test");

    const config = await readFullConfig(tmpDir);
    const items = config.skills.items;

    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.source).toBe("plugin");
      expect(item.marketplace).toBe("ai-registry");
    }
    expect(items.map((i) => i.name).sort()).toEqual(["figma-analyzer", "ideation", "skill-test"]);
  });

  it("(b) keeps duplicate plugin names from different marketplaces distinct", async () => {
    await createSkill("ai-registry", "skill-creator", "1.0.0", "skill-creator");
    await createSkill("claude-plugins-official", "skill-creator", "1.0.0", "skill-creator");

    const config = await readFullConfig(tmpDir);
    const items = config.skills.items.filter((i) => i.name === "skill-creator");

    expect(items).toHaveLength(2);
    const marketplaces = items.map((i) => i.marketplace).sort();
    expect(marketplaces).toEqual(["ai-registry", "claude-plugins-official"]);
  });

  it("(c) does not regress local-style plugins (no installed_plugins.json entry)", async () => {
    // local plugins still live in cache without an installed_plugins.json record
    await createSkill("local", "my-local-plugin", "0.0.1", "my-local-skill");

    const config = await readFullConfig(tmpDir);
    const items = config.skills.items.filter((i) => i.marketplace === "local");

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("my-local-skill");
  });

  it("(d) skips plugin directories that have no skills/ folder", async () => {
    const pluginDir = path.join(tmpDir, "plugins", "cache", "claude-hud", "claude-hud", "0.0.10");
    await mkdir(path.join(pluginDir, "commands"), { recursive: true });
    // no skills/ folder
    await createSkill("ai-registry", "real-skill", "1.0.0", "real-skill");

    const config = await readFullConfig(tmpDir);
    const items = config.skills.items;

    expect(items.find((i) => i.marketplace === "claude-hud")).toBeUndefined();
    expect(items.find((i) => i.name === "real-skill")).toBeDefined();
  });

  it("(e) lists every skill from a multi-skill plugin under the same marketplace", async () => {
    await createSkill("claude-plugins-official", "superpowers", "5.0.1", "brainstorming");
    await createSkill("claude-plugins-official", "superpowers", "5.0.1", "executing-plans");
    await createSkill("claude-plugins-official", "superpowers", "5.0.1", "writing-skills");

    const config = await readFullConfig(tmpDir);
    const items = config.skills.items.filter((i) => i.marketplace === "claude-plugins-official");

    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.pluginName).toBe("superpowers");
    }
    expect(items.map((i) => i.name).sort()).toEqual(["brainstorming", "executing-plans", "writing-skills"]);
  });

  it("(f) handles a marketplace with single-skill and multi-skill plugins mixed", async () => {
    await createSkill("claude-plugins-official", "code-review", "1.0.0", "code-review");
    await createSkill("claude-plugins-official", "frontend-design", "1.0.0", "frontend-design");
    await createSkill("claude-plugins-official", "superpowers", "5.0.1", "brainstorming");
    await createSkill("claude-plugins-official", "superpowers", "5.0.1", "executing-plans");

    const config = await readFullConfig(tmpDir);
    const items = config.skills.items.filter((i) => i.marketplace === "claude-plugins-official");

    expect(items).toHaveLength(4);
    const byPlugin = items.reduce<Record<string, string[]>>((acc, i) => {
      (acc[i.pluginName ?? ""] ??= []).push(i.name);
      return acc;
    }, {});
    expect(byPlugin["code-review"]).toEqual(["code-review"]);
    expect(byPlugin["frontend-design"]).toEqual(["frontend-design"]);
    expect(byPlugin["superpowers"].sort()).toEqual(["brainstorming", "executing-plans"]);
  });

  it("(g) picks the highest version directory deterministically", async () => {
    await createSkill("ai-registry", "versioned", "1.0.0", "versioned");
    await createSkill("ai-registry", "versioned", "1.0.1", "versioned-v2");

    const config = await readFullConfig(tmpDir);
    const items = config.skills.items.filter((i) => i.pluginName === "versioned");

    // sorted lexically, "1.0.1" > "1.0.0", so version-v2 should be picked
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("versioned-v2");
  });
});
