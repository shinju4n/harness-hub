"use client";

import { useState } from "react";
import { RefreshButton } from "@/components/refresh-button";
import { EmptyState } from "@/components/empty-state";
import { useConfirm } from "@/components/confirm-dialog";
import { usePolling } from "@/lib/use-polling";
import { apiFetch, mutate } from "@/lib/api-client";

interface McpServer { command: string; args?: string[]; }

export default function McpPage() {
  const [servers, setServers] = useState<Record<string, McpServer>>({});
  const [mtime, setMtime] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const { confirm, dialog: confirmDialog } = useConfirm();

  const fetchServers = () => {
    apiFetch("/api/mcp").then((r) => r.json()).then((d) => {
      setServers(d.servers ?? {});
      setMtime(d.mtime);
    });
  };

  const { refresh } = usePolling(fetchServers);

  const saveServers = async (updated: Record<string, McpServer>) => {
    const res = await mutate(
      "/api/mcp",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servers: updated, mtime }),
      },
      { success: "MCP servers saved", errorPrefix: "Save failed" }
    );
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
    const ok = await confirm({
      title: "Delete MCP server",
      message: `"${name}" will be removed from your MCP servers config.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const updated = { ...servers };
    delete updated[name];
    await saveServers(updated);
  };

  const entries = Object.entries(servers);

  const serverForm = (
    <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50 space-y-3">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{editingName ? `Edit "${editingName}"` : "New Server"}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
          <input
            type="text"
            placeholder="server-name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Command</label>
          <input
            type="text"
            placeholder="e.g. npx"
            value={formCommand}
            onChange={(e) => setFormCommand(e.target.value)}
            className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Args (space-separated)</label>
          <input
            type="text"
            placeholder="e.g. -y @modelcontextprotocol/server-filesystem /path"
            value={formArgs}
            onChange={(e) => setFormArgs(e.target.value)}
            className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
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
          className="px-4 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">MCP Servers</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{entries.length} configured</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={refresh} />
          {!creating && !editingName && (
            <button
              onClick={startCreate}
              className="text-sm border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg px-3 py-1.5 transition-colors"
            >
              + Add Server
            </button>
          )}
        </div>
      </div>

      {(creating || editingName) && <div className="mb-6">{serverForm}</div>}

      {entries.length === 0 && !creating ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <EmptyState
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="8" rx="2"/>
                <rect x="2" y="14" width="20" height="8" rx="2"/>
                <circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/>
              </svg>
            }
            title="No MCP servers"
            description="Hook up the Model Context Protocol to give Claude access to outside tools and data."
            action={{ label: "Add server", onClick: startCreate }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(([name, config]) => (
            <div key={name} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{name}</h3>
                  <div className="mt-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 overflow-x-auto">
                    <code className="text-xs sm:text-sm font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      $ {config.command} {config.args?.join(" ")}
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 dark:bg-green-950 text-green-600 border border-green-200 dark:border-green-800">
                    active
                  </span>
                  <button
                    onClick={() => startEdit(name, config)}
                    aria-label={`Edit MCP server ${name}`}
                    className="text-xs text-gray-400 hover:text-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors px-2 py-1 rounded hover:bg-amber-50 dark:hover:bg-amber-950"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteServer(name)}
                    aria-label={`Delete MCP server ${name}`}
                    className="text-xs text-red-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
