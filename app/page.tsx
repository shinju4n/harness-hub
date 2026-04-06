"use client";

import { SummaryCard } from "@/components/summary-card";
import { RefreshButton } from "@/components/refresh-button";
import { useConfigStore } from "@/stores/config-store";
import { usePolling } from "@/lib/use-polling";
import { useAppSettingsStore } from "@/stores/app-settings-store";

const icons = {
  plugins: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15.5 2H18a2 2 0 0 1 2 2v2.5M9 2H6a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2v2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h3a2 2 0 0 1 2 2v0a2 2 0 0 1 2-2h3a2 2 0 0 0 2-2v-3a2 2 0 0 1 2-2v-2a2 2 0 0 1-2-2V4a2 2 0 0 0-2-2h-2.5a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2"/></svg>,
  skills: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275z"/></svg>,
  commands: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  hooks: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8a6 6 0 0 1-6 6H4"/><path d="m4 10 4 4-4 4"/></svg>,
  mcp: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/></svg>,
  agents: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="8" rx="2"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M12 2v2"/><path d="M12 20v2"/></svg>,
  rules: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>,
  claudemd: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
};

export default function DashboardPage() {
  const { config, loading, error, fetchConfig } = useConfigStore();
  const { pollingEnabled } = useAppSettingsStore();
  const { refresh } = usePolling(fetchConfig);

  if (loading && !config) {
    return (
      <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 pt-12 justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-amber-500" />
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-6 text-red-600 dark:text-red-400 text-sm">
        <p className="font-medium">Failed to load configuration</p>
        <p className="mt-1 text-red-500">{error}</p>
      </div>
    );
  }

  if (!config) return null;

  const c = config as Record<string, { total?: number; active?: number; exists?: boolean }>;

  return (
    <div>
      <div className="mb-8 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Overview of your Claude Code harness
            {pollingEnabled && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
            )}
          </p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <SummaryCard
          title="Plugins"
          value={String(c.plugins?.total ?? 0)}
          subtitle={`${c.plugins?.active ?? 0} active`}
          href="/plugins"
          icon={icons.plugins}
          color="amber"
        />
        <SummaryCard
          title="Skills"
          value={String(c.skills?.total ?? 0)}
          href="/skills"
          icon={icons.skills}
          color="purple"
        />
        <SummaryCard
          title="Commands"
          value={String(c.commands?.total ?? 0)}
          href="/commands"
          icon={icons.commands}
          color="green"
        />
        <SummaryCard
          title="Hooks"
          value={String(c.hooks?.total ?? 0)}
          href="/hooks"
          icon={icons.hooks}
          color="blue"
        />
        <SummaryCard
          title="MCP Servers"
          value={String(c.mcpServers?.total ?? 0)}
          href="/mcp"
          icon={icons.mcp}
          color="cyan"
        />
        <SummaryCard
          title="Agents"
          value={String(c.agents?.total ?? 0)}
          href="/agents"
          icon={icons.agents}
          color="orange"
        />
        <SummaryCard
          title="Rules"
          value={String(c.rules?.total ?? 0)}
          href="/rules"
          icon={icons.rules}
          color="rose"
        />
        <SummaryCard
          title="CLAUDE.md"
          value={c.claudeMd?.exists ? "Found" : "—"}
          href="/settings"
          icon={icons.claudemd}
          color="gray"
        />
      </div>
    </div>
  );
}
