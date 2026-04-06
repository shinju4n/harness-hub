"use client";

import { useEffect, useState } from "react";

interface PluginData {
  enabledPlugins: Record<string, boolean>;
  installedPlugins: Record<string, Array<{ version: string; installedAt: string }>>;
  settingsMtime: number;
}

export default function PluginsPage() {
  const [data, setData] = useState<PluginData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPlugins = async () => {
    const res = await fetch("/api/plugins");
    if (res.ok) setData(await res.json());
    else setError("Failed to load plugins");
  };

  useEffect(() => { fetchPlugins(); }, []);

  const togglePlugin = async (key: string, enabled: boolean) => {
    if (!data) return;
    const res = await fetch("/api/plugins", {
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

  if (error) return <div className="text-red-500">{error}</div>;
  if (!data) return <div className="text-gray-400">Loading...</div>;

  const plugins = Object.entries(data.installedPlugins);

  if (plugins.length === 0) {
    return <div className="text-gray-400">No plugins installed</div>;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Plugins</h2>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Version</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Installed</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {plugins.map(([key, versions]) => {
              const latest = versions[versions.length - 1];
              const enabled = data.enabledPlugins[key] ?? false;
              return (
                <tr key={key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">{key}</td>
                  <td className="px-4 py-3 text-gray-500">{latest?.version}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {latest?.installedAt ? new Date(latest.installedAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePlugin(key, !enabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        enabled ? "bg-blue-500" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
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
    </div>
  );
}
