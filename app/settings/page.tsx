"use client";

import { useCallback, useEffect, useState } from "react";
import { JsonForm } from "@/components/json-form";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);

  const fetchSettings = useCallback(() => {
    apiFetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings));
  }, []);

  const { refresh } = usePolling(fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Global Claude Code configuration (settings.json)</p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      {settings && (
        <div>
          <JsonForm
            data={settings}
            readOnlyKeys={["hooks"]}
            onSave={async (data) => {
              await apiFetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "settings", content: data }),
              });
            }}
          />
          <div className="mt-4 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300 space-y-1">
            <p>
              Hooks are managed on the{" "}
              <a href="/hooks" className="font-medium underline underline-offset-2">
                Hooks page
              </a>
              .
            </p>
            <p>
              User instructions live on the{" "}
              <a href="/claude-md" className="font-medium underline underline-offset-2">
                CLAUDE.md page
              </a>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
