"use client";

import { useState } from "react";
import { RefreshButton } from "@/components/refresh-button";
import { EmptyState } from "@/components/empty-state";
import { useConfirm } from "@/components/confirm-dialog";
import { usePolling } from "@/lib/use-polling";
import { apiFetch, mutate } from "@/lib/api-client";

type TransportType = "stdio" | "http" | "sse";

interface McpServer {
  type?: TransportType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

const DOCS_URL = "https://code.claude.com/docs/en/mcp";

function stringifyRecord(value?: Record<string, string>): string {
  return value && Object.keys(value).length > 0 ? JSON.stringify(value, null, 2) : "";
}

function parseRecordInput(raw: string, label: string): Record<string, string> | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  const entries = Object.entries(parsed);
  for (const [key, value] of entries) {
    if (typeof value !== "string") {
      throw new Error(`${label}.${key} must be a string`);
    }
  }
  return parsed as Record<string, string>;
}

function displayTransport(config: McpServer): TransportType {
  return config.type ?? (config.url ? "http" : "stdio");
}

function commandPreview(config: McpServer): string {
  const transport = displayTransport(config);
  if (transport === "stdio") {
    return `$ ${config.command ?? ""}${config.args?.length ? ` ${config.args.join(" ")}` : ""}`;
  }
  return config.url ?? "";
}

function countLabel(value?: Record<string, string>): string | null {
  const count = value ? Object.keys(value).length : 0;
  return count > 0 ? `${count} configured` : null;
}

export default function McpPage() {
  const [servers, setServers] = useState<Record<string, McpServer>>({});
  const [mtime, setMtime] = useState<number | null>(null);
  const [filePath, setFilePath] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formTransport, setFormTransport] = useState<TransportType>("stdio");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formHeaders, setFormHeaders] = useState("");
  const [formEnv, setFormEnv] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const fetchServers = async () => {
    const res = await apiFetch("/api/mcp");
    const data = await res.json();
    setServers(data.servers ?? {});
    setMtime(typeof data.mtime === "number" ? data.mtime : null);
    setFilePath(typeof data.filePath === "string" ? data.filePath : "");
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
    if (res.ok) {
      await fetchServers();
    }
    return res.ok;
  };

  const resetForm = () => {
    setFormName("");
    setFormTransport("stdio");
    setFormCommand("");
    setFormArgs("");
    setFormUrl("");
    setFormHeaders("");
    setFormEnv("");
    setFormError(null);
  };

  const startEdit = (name: string, config: McpServer) => {
    setEditingName(name);
    setCreating(false);
    setFormError(null);
    setFormName(name);
    setFormTransport(displayTransport(config));
    setFormCommand(config.command ?? "");
    setFormArgs(config.args?.join(" ") ?? "");
    setFormUrl(config.url ?? "");
    setFormHeaders(stringifyRecord(config.headers));
    setFormEnv(stringifyRecord(config.env));
  };

  const startCreate = () => {
    setCreating(true);
    setEditingName(null);
    resetForm();
  };

  const cancelForm = () => {
    setCreating(false);
    setEditingName(null);
    setFormError(null);
  };

  const submitForm = async () => {
    const nextName = formName.trim();
    if (!nextName) {
      setFormError("Name is required");
      return;
    }

    try {
      const headers = parseRecordInput(formHeaders, "Headers");
      const env = parseRecordInput(formEnv, "Environment");
      const updated = { ...servers };
      if (editingName && editingName !== nextName) {
        delete updated[editingName];
      }

      const config: McpServer =
        formTransport === "stdio"
          ? {
              type: "stdio",
              command: formCommand.trim(),
              ...(formArgs.trim() ? { args: formArgs.trim().split(/\s+/) } : {}),
              ...(env ? { env } : {}),
            }
          : {
              type: formTransport,
              url: formUrl.trim(),
              ...(headers ? { headers } : {}),
            };

      if (formTransport === "stdio" && !config.command) {
        setFormError("Command is required for stdio servers");
        return;
      }

      if ((formTransport === "http" || formTransport === "sse") && !config.url) {
        setFormError("URL is required for remote servers");
        return;
      }

      updated[nextName] = config;
      const ok = await saveServers(updated);
      if (ok) {
        cancelForm();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid MCP configuration");
    }
  };

  const deleteServer = async (name: string) => {
    const ok = await confirm({
      title: "Delete MCP server",
      message: `"${name}" will be removed from your project MCP config.`,
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
    <div className="rounded-3xl border border-amber-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_38%),linear-gradient(180deg,_rgba(255,251,235,0.95),_rgba(255,255,255,0.96))] p-5 shadow-sm dark:border-amber-900/70 dark:bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.14),_transparent_38%),linear-gradient(180deg,_rgba(41,37,36,0.96),_rgba(17,24,39,0.98))]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {editingName ? `Edit "${editingName}"` : "New MCP server"}
          </h3>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Claude Code supports `stdio`, `http`, and deprecated `sse` transports. This screen edits project-scoped `.mcp.json`.
          </p>
        </div>
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full border border-amber-300 px-3 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/60"
        >
          Open docs
        </a>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Name</label>
          <input
            type="text"
            placeholder="github"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Transport</label>
          <select
            value={formTransport}
            onChange={(e) => {
              setFormTransport(e.target.value as TransportType);
              setFormError(null);
            }}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="stdio">stdio</option>
            <option value="http">http</option>
            <option value="sse">sse (deprecated)</option>
          </select>
        </div>

        {formTransport === "stdio" ? (
          <>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Command</label>
              <input
                type="text"
                placeholder="npx"
                value={formCommand}
                onChange={(e) => setFormCommand(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Args</label>
              <input
                type="text"
                placeholder="-y @bytebase/dbhub --dsn postgresql://..."
                value={formArgs}
                onChange={(e) => setFormArgs(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Environment JSON</label>
              <textarea
                value={formEnv}
                onChange={(e) => setFormEnv(e.target.value)}
                placeholder={'{\n  "API_KEY": "${API_KEY}"\n}'}
                spellCheck={false}
                className="min-h-[110px] w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-mono text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
          </>
        ) : (
          <>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">URL</label>
              <input
                type="text"
                placeholder={formTransport === "http" ? "https://mcp.example.com/mcp" : "https://mcp.example.com/sse"}
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Headers JSON</label>
              <textarea
                value={formHeaders}
                onChange={(e) => setFormHeaders(e.target.value)}
                placeholder={'{\n  "Authorization": "Bearer ${API_KEY}"\n}'}
                spellCheck={false}
                className="min-h-[110px] w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-mono text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
          </>
        )}
      </div>

      {formError && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {formError}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-gray-200/80 bg-white/70 px-4 py-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-400">
        <p>
          `http` is the recommended remote transport in the official docs. `sse` still works but is marked deprecated. OAuth for remote servers still happens inside Claude Code via `/mcp`.
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={submitForm}
          className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
        >
          Save
        </button>
        <button
          onClick={cancelForm}
          className="rounded-xl px-4 py-2 text-xs text-gray-500 transition-colors hover:bg-white/70 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">MCP Servers</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Project-scoped `.mcp.json` editor for Claude Code. Use CLI for local or user scope.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={refresh} />
            {!creating && !editingName && (
              <button
                onClick={startCreate}
                className="rounded-xl border border-dashed border-amber-300 px-3 py-1.5 text-sm text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/60"
              >
                + Add Server
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
              Based On Official Docs
            </p>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Claude Code documents three transports: `stdio`, `http`, and deprecated `sse`. Project scope is stored in `.mcp.json`, while local and user scope live in `~/.claude.json`.
            </p>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-amber-300 hover:text-amber-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-amber-700 dark:hover:text-amber-300"
            >
              Claude Code MCP docs
            </a>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-[linear-gradient(135deg,_rgba(255,251,235,0.95),_rgba(255,255,255,0.96))] p-4 shadow-sm dark:border-gray-800 dark:bg-[linear-gradient(135deg,_rgba(41,37,36,0.95),_rgba(17,24,39,0.98))]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
              File
            </p>
            <p className="mt-2 break-all font-mono text-xs text-gray-700 dark:text-gray-300">
              {filePath || ".mcp.json"}
            </p>
            <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
              Team-shared MCP config belongs here. OAuth auth state and local/user scoped servers are managed by Claude Code outside this file.
            </p>
          </div>
        </div>
      </div>

      {(creating || editingName) && <div className="mb-6">{serverForm}</div>}

      {entries.length === 0 && !creating ? (
        <div className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <EmptyState
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="8" rx="2"/>
                <rect x="2" y="14" width="20" height="8" rx="2"/>
                <circle cx="6" cy="6" r="1"/>
                <circle cx="6" cy="18" r="1"/>
              </svg>
            }
            title="No project-scoped MCP servers"
            description="Add a shared `.mcp.json` server for this project, or use Claude CLI if you need local or user scope instead."
            action={{ label: "Add server", onClick: startCreate }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(([name, config]) => {
            const transport = displayTransport(config);
            const headerLabel = countLabel(config.headers);
            const envLabel = countLabel(config.env);
            return (
              <div
                key={name}
                className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{name}</h3>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        {transport}
                      </span>
                      {transport === "sse" && (
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                          deprecated
                        </span>
                      )}
                    </div>
                    <div className="mt-3 overflow-x-auto rounded-2xl bg-gray-50 px-3 py-2 dark:bg-gray-800">
                      <code className="whitespace-nowrap text-xs font-mono text-gray-700 dark:text-gray-300">
                        {commandPreview(config)}
                      </code>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      {headerLabel && (
                        <span className="rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-700">
                          headers: {headerLabel}
                        </span>
                      )}
                      {envLabel && (
                        <span className="rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-700">
                          env: {envLabel}
                        </span>
                      )}
                      {transport === "http" && (
                        <span className="rounded-full border border-green-200 px-2 py-0.5 text-green-700 dark:border-green-900 dark:text-green-300">
                          recommended remote transport
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => startEdit(name, config)}
                      aria-label={`Edit MCP server ${name}`}
                      className="rounded-xl px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-amber-50 hover:text-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:text-gray-400 dark:hover:bg-amber-950/60 dark:hover:text-amber-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteServer(name)}
                      aria-label={`Delete MCP server ${name}`}
                      className="rounded-xl px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
