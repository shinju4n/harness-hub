"use client";

import Link from "next/link";
import { SummaryCard } from "@/components/summary-card";
import { RefreshButton } from "@/components/refresh-button";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { HarnessScorePanel } from "@/components/harness-score-panel";
import { useConfigStore } from "@/stores/config-store";
import { usePolling } from "@/lib/use-polling";
import {
  useAppSettingsStore,
  formatHotkey,
} from "@/stores/app-settings-store";
import { useTerminalStore } from "@/stores/terminal-store";

const icons = {
  plugins: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M15.5 2H18a2 2 0 0 1 2 2v2.5M9 2H6a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2v2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h3a2 2 0 0 1 2 2v0a2 2 0 0 1 2-2h3a2 2 0 0 0 2-2v-3a2 2 0 0 1 2-2v-2a2 2 0 0 1-2-2V4a2 2 0 0 0-2-2h-2.5a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2"/></svg>,
  skills: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275z"/></svg>,
  commands: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  hooks: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M18 8a6 6 0 0 1-6 6H4"/><path d="m4 10 4 4-4 4"/></svg>,
  mcp: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/></svg>,
  agents: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="8" rx="2"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M12 2v2"/><path d="M12 20v2"/></svg>,
  rules: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>,
  claudemd: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  sessions: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  plans: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/></svg>,
  memory: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/><circle cx="12" cy="15" r="2"/></svg>,
};

/**
 * Compact welcome panel showing the two most useful keyboard shortcuts —
 * the configurable terminal toggle and the Cmd/Ctrl+K command palette.
 *
 * The terminal hotkey is read live from the app settings store so it stays
 * in sync if the user rebinds it. The label is rendered with `formatHotkey`
 * (mac glyphs on macOS, Ctrl+X elsewhere). Cmd+K is hard-coded because the
 * palette listener itself is hard-coded.
 */
function ShortcutsPanel() {
  const hotkey = useAppSettingsStore((s) => s.terminalHotkey);
  const toggleTerminal = useTerminalStore((s) => s.toggle);
  const hotkeyLabel = formatHotkey(hotkey);

  return (
    <section
      aria-labelledby="shortcuts-heading"
      className="mb-8 rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-900 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3
            id="shortcuts-heading"
            className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500" aria-hidden="true">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/>
              <path d="M8 16h8"/>
            </svg>
            Quick shortcuts
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Pop a terminal anywhere in the app, or jump to anything by name.
          </p>
        </div>
        <Link
          href="/app-settings"
          className="shrink-0 text-[11px] text-amber-600 dark:text-amber-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
        >
          Customize →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={toggleTerminal}
          className="group flex items-start gap-3 text-left rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 hover:border-amber-300 dark:hover:border-amber-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        >
          <span className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-500" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5"/>
              <line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                Toggle terminal
              </span>
              <kbd className="shrink-0 inline-flex items-center text-[10px] font-mono text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded px-1.5 py-0.5">
                {hotkeyLabel}
              </kbd>
            </div>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
              Slide-up dock with a real shell. Click the badge or press the
              shortcut from any page.
            </p>
          </div>
        </button>

        <div className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
          <span className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-500" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                Command palette
              </span>
              <kbd className="shrink-0 inline-flex items-center text-[10px] font-mono text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded px-1.5 py-0.5">
                ⌘K
              </kbd>
            </div>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
              Search across pages, agents, plans, hook scripts, sessions, and
              history.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { config, loading, error, fetchConfig } = useConfigStore();
  const { pollingEnabled } = useAppSettingsStore();
  const { refresh } = usePolling(fetchConfig);

  if (loading && !config) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-6 text-red-600 dark:text-red-400 text-sm"
      >
        <p className="font-medium">Failed to load configuration</p>
        <p className="mt-1 text-red-500">{error}</p>
        <button
          type="button"
          onClick={refresh}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            <path d="M8 16H3v5"/>
          </svg>
          Try again
        </button>
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
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
                Live
              </span>
            )}
          </p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      <ShortcutsPanel />

      <HarnessScorePanel />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
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
          title="Sessions"
          value={String(c.sessions?.total ?? 0)}
          href="/sessions"
          icon={icons.sessions}
          color="blue"
        />
        <SummaryCard
          title="Plans"
          value={String(c.plans?.total ?? 0)}
          href="/plans"
          icon={icons.plans}
          color="purple"
        />
        <SummaryCard
          title="Memory"
          value={String(c.memory?.total ?? 0)}
          href="/memory"
          icon={icons.memory}
          color="amber"
        />
        <SummaryCard
          title="CLAUDE.md"
          value={c.claudeMd?.exists ? "Found" : "—"}
          href="/claude-md"
          icon={icons.claudemd}
          color="gray"
        />
      </div>
    </div>
  );
}
