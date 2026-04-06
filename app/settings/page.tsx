"use client";

import { useState } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { JsonForm } from "@/components/json-form";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";

type Tab = "settings" | "claude-md";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("settings");
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [claudeMd, setClaudeMd] = useState<string>("");

  const fetchSettings = () => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      setSettings(d.settings);
      setClaudeMd(d.claudeMd);
    });
  };

  const { refresh } = usePolling(fetchSettings);

  const saveClaudeMd = async (content: string) => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "claude-md", content }),
    });
    setClaudeMd(content);
  };

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
          <p className="mt-1 text-sm text-gray-500">Global Claude Code configuration</p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit mb-6">
        <button
          onClick={() => setTab("settings")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all ${
            tab === "settings" ? "bg-white text-gray-900 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          settings.json
        </button>
        <button
          onClick={() => setTab("claude-md")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all ${
            tab === "claude-md" ? "bg-white text-gray-900 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          CLAUDE.md
        </button>
      </div>

      {tab === "settings" && settings && (
        <div>
          <JsonForm
            data={settings}
            readOnlyKeys={["hooks"]}
            onSave={async (data) => {
              await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "settings", content: data }),
              });
            }}
          />
          <div className="mt-4 p-3 rounded-lg bg-amber-50/50 border border-amber-200 text-sm text-amber-700">
            Hooks are managed on the <a href="/hooks" className="font-medium underline underline-offset-2">Hooks page</a>.
          </div>
        </div>
      )}

      {tab === "claude-md" && (
        <MarkdownViewer content={claudeMd} fileName="CLAUDE.md" onSave={saveClaudeMd} />
      )}
    </div>
  );
}
