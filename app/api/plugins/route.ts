import { NextRequest, NextResponse } from "next/server";
import { getClaudeHome } from "@/lib/claude-home";
import { readJsonFile, writeJsonFile } from "@/lib/file-ops";
import path from "path";

export async function GET() {
  const claudeHome = getClaudeHome();
  const [settings, installed] = await Promise.all([
    readJsonFile<Record<string, unknown>>(path.join(claudeHome, "settings.json")),
    readJsonFile<{ plugins: Record<string, Array<Record<string, string>>> }>(
      path.join(claudeHome, "plugins", "installed_plugins.json")
    ),
  ]);

  return NextResponse.json({
    enabledPlugins: (settings.data as Record<string, unknown>)?.enabledPlugins ?? {},
    installedPlugins: installed.data?.plugins ?? {},
    settingsMtime: settings.mtime,
  });
}

export async function PATCH(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const settingsPath = path.join(claudeHome, "settings.json");
  const { pluginKey, enabled, mtime } = await request.json();

  const settings = await readJsonFile<Record<string, unknown>>(settingsPath);
  if (!settings.data) {
    return NextResponse.json({ error: "Cannot read settings" }, { status: 500 });
  }

  const enabledPlugins = (settings.data.enabledPlugins as Record<string, boolean>) ?? {};
  enabledPlugins[pluginKey] = enabled;
  settings.data.enabledPlugins = enabledPlugins;

  const result = await writeJsonFile(settingsPath, settings.data, mtime);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
