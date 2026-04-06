"use client";

import { useState } from "react";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";

interface McpServer { command: string; args?: string[]; }

export default function McpPage() {
  const [servers, setServers] = useState<Record<string, McpServer>>({});
  const [mtime, setMtime] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");

  const fetchServers = () => {
    fetch("/api/mcp").then((r) => r.json()).then((d) => {
      setServers(d.servers ?? {});
      setMtime(d.mtime);
    });
  };

  const { refresh } = usePolling(fetchServers);

  const saveServers = async (updated: Record<string, McpServer>) => {
    const res = await fetch("/api/mcp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ servers: updated, mtime }),
    });
    if (res.ok) { fetchServers(); }
    return res.ok;
  };

  const startEdit = (name: string, config: McpServer) => {
    setEditingName(name);
    setFormName(name);
    setFormCommand(config.command);
    setFormArgs(config.args?.join(" ") ?? "");
    setCreating(false);
  };

  const startCreate = () => {
    setCreating(true);
    setEditingName(null);
    setFormName("");
    setFormCommand("");
    setFormArgs("");
  };

  const cancelForm = () => {
    setCreating(false);
    setEditingName(null);
  };

  const submitForm = async () => {
    if (!formName.trim() || !formCommand.trim()) return;
    const args = formArgs.trim() ? formArgs.trim().split(/\s+/) : undefined;
    const updated = { ...servers };
    if (editingName && editingName !== formName.trim()) {
      delete updated[editingName];
    }
    updated[formName.trim()] = { command: formCommand.trim(), ...(args ? { args } : {}) };
    const ok = await saveServers(updated);
    if (ok) { cancelForm(); }
  };

  const deleteServer = async (name: string) => {
    if (!window.confirm(`Delete MCP server "${name}"?`)) return;
    const updated = { ...servers };
    delete updated[name];
    await saveServers(updated);
  };

  const entries = Object.entries(servers);

  const serverForm = (
    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
      <h3 className="text-sm font-medium text-gray-700">{editingName ? `Edit "${editingName}"` : "New Server"}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input
            type="text"
            placeholder="server-name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Command</label>
          <input
            type="text"
            placeholder="e.g. npx"
            value={formCommand}
            onChange={(e) => setFormCommand(e.target.value)}
            className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Args (space-separated)</label>
          <input
            type="text"
            placeholder="e.g. -y @modelcontextprotocol/server-filesystem /path"
            value={formArgs}
            onChange={(e) => setFormArgs(e.target.value)}
            className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={submitForm}
          className="px-4 py-1.5 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
        >
          Save
        </button>
        <button
          onClick={cancelForm}
          className="px-4 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">MCP Servers</h2>
          <p className="mt-1 text-sm text-gray-500">{entries.length} configured</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={refresh} />
          {!creating && !editingName && (
            <button
              onClick={startCreate}
              className="text-sm border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 rounded-lg px-3 py-1.5 transition-colors"
            >
              + Add Server
            </button>
          )}
        </div>
      </div>

      {(creating || editingName) && <div className="mb-6">{serverForm}</div>}

      {entries.length === 0 && !creating ? (
        <div className="text-gray-400 text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
          No MCP servers configured
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(([name, config]) => (
            <div key={name} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900">{name}</h3>
                  <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 overflow-x-auto">
                    <code className="text-xs sm:text-sm font-mono text-gray-600 whitespace-nowrap">
                      $ {config.command} {config.args?.join(" ")}
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-600 border border-green-200">
                    active
                  </span>
                  <button
                    onClick={() => startEdit(name, config)}
                    className="text-xs text-gray-400 hover:text-amber-600 transition-colors px-2 py-1 rounded hover:bg-amber-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteServer(name)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
