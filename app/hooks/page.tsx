"use client";

import { useEffect, useState } from "react";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";
import { ScriptEditorDynamic } from "@/components/script-editor-dynamic";

interface HookEntry {
  matcher?: string;
  hooks: Array<{ type: string; command: string; timeout?: number }>;
}

type HooksData = Record<string, HookEntry[]>;
type Tab = "bindings" | "scripts";

interface HookFileSummary {
  name: string;
  language: "javascript" | "typescript" | "python" | "shell";
  size: number;
  mtime: number;
}

interface HookFileDetail extends HookFileSummary {
  content: string;
}

const EVENT_TYPES = [
  "PreToolUse",
  "PostToolUse",
  "Notification",
  "Stop",
  "SubagentStop",
];

const LANG_BADGE: Record<HookFileSummary["language"], string> = {
  javascript: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
  typescript: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  python: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  shell: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

/**
 * Pull every reference to a script in ~/.claude/hooks/ out of an arbitrary
 * shell command. Matches whether the path is `~/.claude/hooks/foo.mjs`,
 * `$HOME/.claude/hooks/foo.mjs`, or `/Users/.../.claude/hooks/foo.mjs`.
 * Returns just the basenames (deduped, in order of first appearance).
 */
function extractHookFileRefs(command: string): string[] {
  const re = /\.claude\/hooks\/([A-Za-z0-9._-]+\.(?:mjs|cjs|js|ts|py|sh))/g;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of command.matchAll(re)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

export default function HooksPage() {
  const [tab, setTab] = useState<Tab>("bindings");

  // Bindings state
  const [hooks, setHooks] = useState<HooksData>({});
  const [mtime, setMtime] = useState<number>(0);
  const [creating, setCreating] = useState(false);
  const [newEvent, setNewEvent] = useState(EVENT_TYPES[0]);
  const [newMatcher, setNewMatcher] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [newTimeout, setNewTimeout] = useState("");

  // Binding inline-edit state
  const [editingBinding, setEditingBinding] = useState<{ event: string; index: number } | null>(null);
  const [editEvent, setEditEvent] = useState(EVENT_TYPES[0]);
  const [editMatcher, setEditMatcher] = useState("");
  const [editCommand, setEditCommand] = useState("");
  const [editTimeout, setEditTimeout] = useState("");

  // Scripts state
  const [files, setFiles] = useState<HookFileSummary[]>([]);
  const [selected, setSelected] = useState<HookFileDetail | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [savingScript, setSavingScript] = useState(false);
  const [creatingScript, setCreatingScript] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [scriptError, setScriptError] = useState<string | null>(null);

  const fetchHooks = () => {
    apiFetch("/api/hooks").then((r) => r.json()).then((d) => {
      setHooks(d.hooks);
      setMtime(d.mtime);
    });
  };

  const fetchFiles = () => {
    apiFetch("/api/hooks/files").then((r) => r.json()).then((d) => setFiles(d.files ?? []));
  };

  const { refresh } = usePolling(() => {
    fetchHooks();
    fetchFiles();
  });

  useEffect(() => {
    fetchFiles();
  }, []);

  const events = Object.entries(hooks);

  const deleteHook = async (event: string, entryIndex: number) => {
    const updated = { ...hooks };
    updated[event] = updated[event].filter((_, i) => i !== entryIndex);
    if (updated[event].length === 0) delete updated[event];
    const res = await apiFetch("/api/hooks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hooks: updated, mtime }),
    });
    if (res.ok) {
      setHooks(updated);
      const data = await fetch("/api/hooks").then((r) => r.json());
      setMtime(data.mtime);
    }
  };

  const createHook = async () => {
    if (!newCommand.trim()) return;
    const updated = { ...hooks };
    const entry: HookEntry = {
      hooks: [{
        type: "command",
        command: newCommand.trim(),
        ...(newTimeout ? { timeout: parseInt(newTimeout, 10) } : {}),
      }],
      ...(newMatcher.trim() ? { matcher: newMatcher.trim() } : {}),
    };
    if (!updated[newEvent]) updated[newEvent] = [];
    updated[newEvent] = [...updated[newEvent], entry];
    const res = await apiFetch("/api/hooks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hooks: updated, mtime }),
    });
    if (res.ok) {
      setCreating(false);
      setNewCommand("");
      setNewMatcher("");
      setNewTimeout("");
      fetchHooks();
    }
  };

  const startEditBinding = (event: string, index: number) => {
    const entry = hooks[event][index];
    setEditingBinding({ event, index });
    setEditEvent(event);
    setEditMatcher(entry.matcher ?? "");
    setEditCommand(entry.hooks[0]?.command ?? "");
    setEditTimeout(entry.hooks[0]?.timeout != null ? String(entry.hooks[0].timeout) : "");
  };

  const cancelEditBinding = () => {
    setEditingBinding(null);
  };

  const saveEditBinding = async () => {
    if (!editingBinding || !editCommand.trim()) return;
    const { event: origEvent, index } = editingBinding;
    const updatedEntry: HookEntry = {
      hooks: [{
        type: "command",
        command: editCommand.trim(),
        ...(editTimeout ? { timeout: parseInt(editTimeout, 10) } : {}),
      }],
      ...(editMatcher.trim() ? { matcher: editMatcher.trim() } : {}),
    };
    const updated = { ...hooks };
    // Remove from original event
    updated[origEvent] = updated[origEvent].filter((_, i) => i !== index);
    if (updated[origEvent].length === 0) delete updated[origEvent];
    // Add to (possibly new) event
    if (!updated[editEvent]) updated[editEvent] = [];
    updated[editEvent] = [...updated[editEvent], updatedEntry];
    const res = await apiFetch("/api/hooks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hooks: updated, mtime }),
    });
    if (res.ok) {
      setEditingBinding(null);
      fetchHooks();
    }
  };

  // ─── Scripts handlers ───────────────────────────────────────────────────

  const jumpToScript = (name: string) => {
    setTab("scripts");
    viewScript(name);
  };

  const viewScript = async (name: string) => {
    setEditing(false);
    setScriptError(null);
    const res = await apiFetch(`/api/hooks/files?name=${encodeURIComponent(name)}`);
    if (res.ok) {
      const data: HookFileDetail = await res.json();
      setSelected(data);
      setEditContent(data.content);
    } else {
      const err = await res.json().catch(() => ({ error: "load failed" }));
      setScriptError(err.error ?? "load failed");
    }
  };

  const saveScript = async () => {
    if (!selected) return;
    setSavingScript(true);
    const res = await apiFetch("/api/hooks/files", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selected.name, content: editContent }),
    });
    setSavingScript(false);
    if (res.ok) {
      setEditing(false);
      await viewScript(selected.name);
      fetchFiles();
    } else {
      const err = await res.json().catch(() => ({ error: "save failed" }));
      setScriptError(err.error ?? "save failed");
    }
  };

  const deleteScript = async (name: string) => {
    if (!window.confirm(`Delete hook script "${name}"?`)) return;
    const res = await apiFetch(`/api/hooks/files?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      if (selected?.name === name) {
        setSelected(null);
        setEditContent("");
      }
      fetchFiles();
    }
  };

  const createScript = async () => {
    setScriptError(null);
    const name = newFileName.trim();
    if (!name) return;
    const res = await apiFetch("/api/hooks/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content: newFileContent }),
    });
    if (res.ok) {
      setCreatingScript(false);
      setNewFileName("");
      setNewFileContent("");
      fetchFiles();
      viewScript(name);
    } else {
      const err = await res.json().catch(() => ({ error: "create failed" }));
      setScriptError(err.error ?? "create failed");
    }
  };

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Hooks</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {events.length} event types · {files.length} script{files.length === 1 ? "" : "s"} in ~/.claude/hooks/
          </p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1 w-fit mb-6">
        <button
          onClick={() => setTab("bindings")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all ${
            tab === "bindings"
              ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm font-medium"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Bindings
        </button>
        <button
          onClick={() => setTab("scripts")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all ${
            tab === "scripts"
              ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm font-medium"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Scripts
          {files.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {files.length}
            </span>
          )}
        </button>
      </div>

      {tab === "bindings" && (
        <div>
          <div className="mb-4 flex justify-end">
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="text-sm border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg px-3 py-1.5 transition-colors"
              >
                + New Hook
              </button>
            )}
          </div>

          {creating && (
            <div className="mb-6 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50 space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">New Hook</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Event type</label>
                  <select
                    value={newEvent}
                    onChange={(e) => setNewEvent(e.target.value)}
                    className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Matcher (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Bash"
                    value={newMatcher}
                    onChange={(e) => setNewMatcher(e.target.value)}
                    className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Command</label>
                  <input
                    type="text"
                    placeholder="e.g. echo $CLAUDE_TOOL_NAME"
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                    className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Timeout ms (optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={newTimeout}
                    onChange={(e) => setNewTimeout(e.target.value)}
                    className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={createHook}
                  className="px-4 py-1.5 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => { setCreating(false); setNewCommand(""); setNewMatcher(""); setNewTimeout(""); }}
                  className="px-4 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {events.length === 0 && !creating ? (
            <div className="text-gray-400 dark:text-gray-500 text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              No hooks configured
            </div>
          ) : (
            <div className="space-y-4">
              {events.map(([event, entries]) => (
                <div key={event} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{event}</h3>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {entries.map((entry, i) => {
                      const isEditing = editingBinding?.event === event && editingBinding?.index === i;
                      if (isEditing) {
                        return (
                          <div key={i} className="px-4 py-4 bg-amber-50/40 dark:bg-amber-950/30">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Event type</label>
                                <select
                                  value={editEvent}
                                  onChange={(e) => setEditEvent(e.target.value)}
                                  className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
                                >
                                  {EVENT_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Matcher (optional)</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Bash"
                                  value={editMatcher}
                                  onChange={(e) => setEditMatcher(e.target.value)}
                                  className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Command</label>
                                <input
                                  type="text"
                                  placeholder="e.g. echo $CLAUDE_TOOL_NAME"
                                  value={editCommand}
                                  onChange={(e) => setEditCommand(e.target.value)}
                                  className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Timeout ms (optional)</label>
                                <input
                                  type="number"
                                  placeholder="e.g. 5000"
                                  value={editTimeout}
                                  onChange={(e) => setEditTimeout(e.target.value)}
                                  className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={saveEditBinding}
                                className="px-4 py-1.5 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditBinding}
                                className="px-4 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return (
                      <div key={i} className="px-4 py-3.5 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 font-mono text-gray-500 dark:text-gray-400">
                              {entry.matcher ?? "*"}
                            </span>
                          </div>
                          {entry.hooks.map((hook, j) => {
                            const refs = extractHookFileRefs(hook.command);
                            // Only treat refs as clickable if the file actually
                            // exists in ~/.claude/hooks/, otherwise the link
                            // would just produce a 404.
                            const knownRefs = refs.filter((name) =>
                              files.some((f) => f.name === name)
                            );
                            return (
                              <div key={j} className="mt-2 text-sm">
                                <code className="font-mono text-gray-700 dark:text-gray-300 text-xs sm:text-sm break-all">{hook.command}</code>
                                {hook.timeout && (
                                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                                    {hook.timeout >= 1000 ? `${hook.timeout / 1000}s` : `${hook.timeout}ms`}
                                  </span>
                                )}
                                {knownRefs.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500">→</span>
                                    {knownRefs.map((name) => (
                                      <button
                                        key={name}
                                        onClick={() => jumpToScript(name)}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                                        title={`Open ${name} in Scripts tab`}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                        {name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="shrink-0 flex gap-1">
                          <button
                            onClick={() => startEditBinding(event, i)}
                            className="text-xs text-gray-400 hover:text-amber-600 transition-colors px-2 py-1 rounded hover:bg-amber-50 dark:hover:bg-amber-950"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteHook(event, i)}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "scripts" && (
        <ScriptsTab
          files={files}
          selected={selected}
          editContent={editContent}
          setEditContent={setEditContent}
          editing={editing}
          setEditing={setEditing}
          saving={savingScript}
          onSelect={viewScript}
          onSave={saveScript}
          onDelete={deleteScript}
          creating={creatingScript}
          setCreating={setCreatingScript}
          newName={newFileName}
          setNewName={setNewFileName}
          newContent={newFileContent}
          setNewContent={setNewFileContent}
          onCreate={createScript}
          error={scriptError}
        />
      )}
    </div>
  );
}

interface ScriptsTabProps {
  files: HookFileSummary[];
  selected: HookFileDetail | null;
  editContent: string;
  setEditContent: (s: string) => void;
  editing: boolean;
  setEditing: (b: boolean) => void;
  saving: boolean;
  onSelect: (name: string) => void;
  onSave: () => void;
  onDelete: (name: string) => void;
  creating: boolean;
  setCreating: (b: boolean) => void;
  newName: string;
  setNewName: (s: string) => void;
  newContent: string;
  setNewContent: (s: string) => void;
  onCreate: () => void;
  error: string | null;
}

function ScriptsTab({
  files,
  selected,
  editContent,
  setEditContent,
  editing,
  setEditing,
  saving,
  onSelect,
  onSave,
  onDelete,
  creating,
  setCreating,
  newName,
  setNewName,
  newContent,
  setNewContent,
  onCreate,
  error,
}: ScriptsTabProps) {
  const fileList = (
    <div className="space-y-0.5">
      {files.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          No hook scripts in ~/.claude/hooks/
        </p>
      ) : (
        files.map((f) => (
          <div key={f.name} className="flex items-start gap-1 group">
            <button
              onClick={() => onSelect(f.name)}
              className={`flex-1 text-left px-3 py-2.5 rounded-lg text-[13px] transition-all ${
                selected?.name === f.name
                  ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase ${LANG_BADGE[f.language]}`}>
                  {f.language === "javascript" ? "js" : f.language === "typescript" ? "ts" : f.language === "python" ? "py" : "sh"}
                </span>
                <span className="truncate font-mono text-[12px]">{f.name}</span>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 pl-0.5">
                {formatBytes(f.size)}
              </p>
            </button>
            <button
              onClick={() => onDelete(f.name)}
              className="mt-2 shrink-0 text-xs text-gray-300 dark:text-gray-700 hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 focus-visible:text-red-500 transition-all px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
            >
              Delete
            </button>
          </div>
        ))
      )}
    </div>
  );

  const createForm = creating ? (
    <div className="mt-3 p-3 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50/50 dark:bg-amber-950/50 space-y-2">
      <input
        type="text"
        placeholder="hook-name.mjs"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
      />
      <textarea
        placeholder="// script content"
        value={newContent}
        onChange={(e) => setNewContent(e.target.value)}
        rows={5}
        className="w-full text-[12px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400 resize-none"
      />
      <p className="text-[10px] text-gray-500 dark:text-gray-400">
        Allowed extensions: .mjs, .cjs, .js, .ts, .py, .sh
      </p>
      <div className="flex gap-1.5">
        <button
          onClick={onCreate}
          className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => { setCreating(false); setNewName(""); setNewContent(""); }}
          className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => setCreating(true)}
      className="mt-3 w-full text-[13px] border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg py-1.5 transition-colors"
    >
      + New Script
    </button>
  );

  return (
    <>
      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Mobile */}
      <div className="lg:hidden">
        {!selected ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
            {fileList}
            {createForm}
          </div>
        ) : (
          <ScriptDetail
            file={selected}
            content={editContent}
            setContent={setEditContent}
            editing={editing}
            setEditing={setEditing}
            saving={saving}
            onSave={onSave}
          />
        )}
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex gap-6">
        <div className="w-64 shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm self-start sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {fileList}
          {createForm}
        </div>
        <div className="flex-1 min-w-0">
          {selected ? (
            <ScriptDetail
              file={selected}
              content={editContent}
              setContent={setEditContent}
              editing={editing}
              setEditing={setEditing}
              saving={saving}
              onSave={onSave}
            />
          ) : (
            <div className="text-gray-400 dark:text-gray-500 text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              Select a script to view
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ScriptDetail({
  file,
  content,
  setContent,
  editing,
  setEditing,
  saving,
  onSave,
}: {
  file: HookFileDetail;
  content: string;
  setContent: (s: string) => void;
  editing: boolean;
  setEditing: (b: boolean) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase ${LANG_BADGE[file.language]}`}>
            {file.language}
          </span>
          <code className="font-mono text-[12px] text-gray-700 dark:text-gray-300 truncate">{file.name}</code>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{formatBytes(file.size)}</span>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {editing ? (
            <>
              <button
                onClick={onSave}
                disabled={saving}
                className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => { setEditing(false); setContent(file.content); }}
                className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <ScriptEditorDynamic
          filename={file.name}
          value={content}
          onChange={setContent}
        />
      ) : (
        <pre className="p-4 bg-gray-50 dark:bg-gray-950 text-[12px] leading-relaxed text-gray-800 dark:text-gray-200 overflow-x-auto">
{file.content}
        </pre>
      )}
    </div>
  );
}
