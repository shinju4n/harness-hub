"use client";

import { useEffect } from "react";
import { SummaryCard } from "@/components/summary-card";
import { useConfigStore } from "@/stores/config-store";

export default function DashboardPage() {
  const { config, loading, error, fetchConfig } = useConfigStore();

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-600">
        {error}
      </div>
    );
  }

  if (!config) return null;

  const c = config as Record<string, { total?: number; active?: number; exists?: boolean }>;

  return (
    <div className="grid grid-cols-3 gap-4">
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
  );
}
