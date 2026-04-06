"use client";

import { useEffect, useRef } from "react";
import { SummaryCard } from "@/components/summary-card";
import { useConfigStore } from "@/stores/config-store";

export default function DashboardPage() {
  const { config, loading, error, fetchConfig } = useConfigStore();
  const fetched = useRef(false);

  useEffect(() => {
    if (!fetched.current) {
      fetched.current = true;
      fetchConfig();
    }
  }, [fetchConfig]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 pt-12 justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-amber-500" />
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-600 text-sm">
        <p className="font-medium">Failed to load configuration</p>
        <p className="mt-1 text-red-500">{error}</p>
      </div>
    );
  }

  if (!config) return null;

  const c = config as Record<string, { total?: number; active?: number; exists?: boolean }>;

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0">
        <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-500">Overview of your Claude Code harness</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard
          title="Plugins"
          value={String(c.plugins?.total ?? 0)}
          subtitle={`${c.plugins?.active ?? 0} active`}
          href="/plugins"
        />
        <SummaryCard
          title="Skills"
          value={String(c.skills?.total ?? 0)}
          href="/skills"
        />
        <SummaryCard
          title="Commands"
          value={String(c.commands?.total ?? 0)}
          href="/commands"
        />
        <SummaryCard
          title="Hooks"
          value={String(c.hooks?.total ?? 0)}
          href="/hooks"
        />
        <SummaryCard
          title="MCP Servers"
          value={String(c.mcpServers?.total ?? 0)}
          href="/mcp"
        />
        <SummaryCard
          title="CLAUDE.md"
          value={c.claudeMd?.exists ? "Found" : "Not found"}
          href="/settings"
        />
      </div>
    </div>
  );
}
