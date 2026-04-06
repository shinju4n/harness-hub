import path from "path";
import { readdir } from "fs/promises";
import { readJsonFile, readMarkdownFile } from "./file-ops";

interface PluginInfo {
  name: string;
  marketplace: string;
  version: string;
  installedAt: string;
  enabled: boolean;
}

interface SkillInfo {
  name: string;
  source: "plugin" | "custom";
  pluginName?: string;
  description?: string;
}

interface CommandInfo {
  name: string;
  fileName: string;
}

interface HookInfo {
  event: string;
  matcher: string;
  command: string;
  timeout?: number;
}

interface McpServerInfo {
  name: string;
  command: string;
  args: string[];
}

interface ConfigSummary {
  plugins: { items: PluginInfo[]; total: number; active: number };
  skills: { items: SkillInfo[]; total: number };
  commands: { items: CommandInfo[]; total: number };
  hooks: { items: HookInfo[]; total: number };
  mcpServers: { items: McpServerInfo[]; total: number };
  agents: { total: number };
  rules: { total: number };
  claudeMd: { exists: boolean };
}

export async function readFullConfig(claudeHome: string): Promise<ConfigSummary> {
  const [plugins, skills, commands, hooks, mcpServers, agents, rules, claudeMd] = await Promise.all([
    readPlugins(claudeHome),
    readSkills(claudeHome),
    readCommands(claudeHome),
    readHooks(claudeHome),
    readMcpServers(claudeHome),
    readAgentCount(claudeHome),
    readRuleCount(claudeHome),
    readClaudeMdExists(claudeHome),
  ]);
  return { plugins, skills, commands, hooks, mcpServers, agents, rules, claudeMd };
}

async function readPlugins(claudeHome: string) {
  const settingsResult = await readJsonFile<Record<string, unknown>>(
    path.join(claudeHome, "settings.json")
  );
  const enabledPlugins = (settingsResult.data?.enabledPlugins as Record<string, boolean>) ?? {};

  const installedResult = await readJsonFile<{
    version: number;
    plugins: Record<string, Array<{ version: string; installedAt: string; installPath: string }>>;
  }>(path.join(claudeHome, "plugins", "installed_plugins.json"));

  const items: PluginInfo[] = [];
  const pluginsData = installedResult.data?.plugins ?? {};

  for (const [key, versions] of Object.entries(pluginsData)) {
    const latest = versions[versions.length - 1];
    const [pluginName, marketplace] = key.split("@").reverse();
    items.push({
      name: pluginName ?? key,
      marketplace: marketplace ?? "",
      version: latest?.version ?? "unknown",
      installedAt: latest?.installedAt ?? "",
      enabled: enabledPlugins[key] ?? false,
    });
  }

  return {
    items,
    total: items.length,
    active: items.filter((p) => p.enabled).length,
  };
}

async function readSkills(claudeHome: string) {
  const items: SkillInfo[] = [];

  try {
    const customDir = path.join(claudeHome, "skills");
    const entries = await readdir(customDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        items.push({ name: entry.name, source: "custom" });
      }
    }
  } catch {}

  try {
    const cacheDir = path.join(claudeHome, "plugins", "cache");
    const marketplaces = await readdir(cacheDir, { withFileTypes: true });
    for (const mp of marketplaces) {
      if (!mp.isDirectory() || mp.name.startsWith(".")) continue;
      const mpDir = path.join(cacheDir, mp.name);
      const pluginDirs = await readdir(mpDir, { withFileTypes: true });
      for (const pd of pluginDirs) {
        if (!pd.isDirectory()) continue;
        const versionDirs = await readdir(path.join(mpDir, pd.name), { withFileTypes: true });
        const latestVersion = versionDirs.filter((v) => v.isDirectory()).pop();
        if (!latestVersion) continue;
        const skillsDir = path.join(mpDir, pd.name, latestVersion.name, "skills");
        try {
          const skills = await readdir(skillsDir, { withFileTypes: true });
          for (const skill of skills) {
            if (skill.isDirectory()) {
              items.push({ name: skill.name, source: "plugin", pluginName: pd.name });
            }
          }
        } catch {}
      }
    }
  } catch {}

  return { items, total: items.length };
}

async function readCommands(claudeHome: string) {
  const items: CommandInfo[] = [];
  try {
    const dir = path.join(claudeHome, "commands");
    const entries = await readdir(dir);
    for (const name of entries) {
      if (name.endsWith(".md")) {
        items.push({ name: name.replace(".md", ""), fileName: name });
      }
    }
  } catch {}
  return { items, total: items.length };
}

async function readHooks(claudeHome: string) {
  const items: HookInfo[] = [];
  const settingsResult = await readJsonFile<Record<string, unknown>>(
    path.join(claudeHome, "settings.json")
  );
  const hooks =
    (settingsResult.data?.hooks as Record<
      string,
      Array<{ matcher?: string; hooks: Array<{ type: string; command: string; timeout?: number }> }>
    >) ?? {};

  for (const [event, hookGroups] of Object.entries(hooks)) {
    for (const group of hookGroups) {
      for (const hook of group.hooks) {
        items.push({ event, matcher: group.matcher ?? "*", command: hook.command, timeout: hook.timeout });
      }
    }
  }
  return { items, total: items.length };
}

async function readMcpServers(claudeHome: string) {
  const items: McpServerInfo[] = [];
  const result = await readJsonFile<{
    mcpServers: Record<string, { command: string; args?: string[] }>;
  }>(path.join(claudeHome, ".mcp.json"));
  const servers = result.data?.mcpServers ?? {};
  for (const [name, config] of Object.entries(servers)) {
    items.push({ name, command: config.command, args: config.args ?? [] });
  }
  return { items, total: items.length };
}

async function readAgentCount(claudeHome: string) {
  try {
    const dir = path.join(claudeHome, "agents");
    const entries = await readdir(dir);
    return { total: entries.filter((f: string) => f.endsWith(".md")).length };
  } catch {
    return { total: 0 };
  }
}

async function readRuleCount(claudeHome: string) {
  try {
    const dir = path.join(claudeHome, "rules");
    const entries = await readdir(dir);
    return { total: entries.filter((f: string) => f.endsWith(".md")).length };
  } catch {
    return { total: 0 };
  }
}

async function readClaudeMdExists(claudeHome: string) {
  const result = await readMarkdownFile(path.join(claudeHome, "CLAUDE.md"));
  return { exists: result.data !== null };
}
