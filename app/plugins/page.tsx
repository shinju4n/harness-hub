"use client";

import { useState } from "react";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";

interface PluginData {
  enabledPlugins: Record<string, boolean>;
  installedPlugins: Record<string, Array<{ version: string; installedAt: string }>>;
  settingsMtime: number;
}

export default function PluginsPage() {
  const [data, setData] = useState<PluginData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPlugins = async () => {
    const res = await apiFetch("/api/plugins");
    if (res.ok) setData(await res.json());
    else setError("Failed to load plugins");
  };

  const { refresh } = usePolling(fetchPlugins);

  const togglePlugin = async (key: string, enabled: boolean) => {
    if (!data) return;
    const res = await apiFetch("/api/plugins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pluginKey: key, enabled, mtime: data.settingsMtime }),
    });
    if (res.ok) fetchPlugins();
    else {
      const err = await res.json();
      setError(err.error);
    }
  };

  if (error) return <div className="text-red-500 text-sm">{error}</div>;
  if (!data) return <div className="text-gray-400 dark:text-gray-500 pt-12 text-center">Loading...</div>;

  const plugins = Object.entries(data.installedPlugins);

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Plugins</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{plugins.length} installed</p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      {plugins.length === 0 ? (
        <div className="text-gray-400 dark:text-gray-500 text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">No plugins installed</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Installed</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {plugins.map(([key, versions]) => {
                  const latest = versions[versions.length - 1];
                  const enabled = data.enabledPlugins[key] ?? false;
                  return (
                    <tr key={key} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-sm text-gray-900 dark:text-gray-100">{key}</td>
                      <td className="px-4 py-3.5 text-gray-500 dark:text-gray-400 tabular-nums">{latest?.version}</td>
                      <td className="px-4 py-3.5 text-gray-500 dark:text-gray-400">
                        {latest?.installedAt ? new Date(latest.installedAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => togglePlugin(key, !enabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            enabled ? "bg-amber-500" : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                              enabled ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="sm:hidden space-y-3">
            {plugins.map(([key, versions]) => {
              const latest = versions[versions.length - 1];
              const enabled = data.enabledPlugins[key] ?? false;
              return (
                <div key={key} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-gray-900 dark:text-gray-100 truncate mr-3">{key}</span>
                    <button
                      onClick={() => togglePlugin(key, !enabled)}
                      className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        enabled ? "bg-amber-500" : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-gray-400 dark:text-gray-500">
                    <span>v{latest?.version}</span>
                    <span>{latest?.installedAt ? new Date(latest.installedAt).toLocaleDateString() : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
