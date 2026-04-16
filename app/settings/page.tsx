"use client";

import { useCallback, useEffect, useState } from "react";
import { JsonForm } from "@/components/json-form";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [mtime, setMtime] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    const r = await apiFetch("/api/settings");
    const d = await r.json();
    setSettings(d.settings);
    setMtime(typeof d.settingsMtime === "number" ? d.settingsMtime : null);
  }, []);

  const { refresh } = usePolling(fetchSettings);

  useEffect(() => {
    // Initial load; fetchSettings updates local state from the API response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          {saveError && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
              {saveError}
            </div>
          )}
          <JsonForm
            data={settings}
            readOnlyKeys={["hooks"]}
            onSave={async (data) => {
              setSaveError(null);
              const res = await apiFetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "settings", content: data, mtime }),
              });
              if (!res.ok) {
                const payload = await res.json().catch(() => null);
                const message =
                  payload && typeof payload.error === "string"
                    ? payload.error
                    : "Failed to save settings";
                setSaveError(message);
                throw new Error(message);
              }
              await fetchSettings();
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
