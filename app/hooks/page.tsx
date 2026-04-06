"use client";

import { useState } from "react";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";

interface HookEntry {
  matcher?: string;
  hooks: Array<{ type: string; command: string; timeout?: number }>;
}

type HooksData = Record<string, HookEntry[]>;

const EVENT_TYPES = [
  "PreToolUse",
  "PostToolUse",
  "Notification",
  "Stop",
  "SubagentStop",
];

export default function HooksPage() {
  const [hooks, setHooks] = useState<HooksData>({});
  const [mtime, setMtime] = useState<number>(0);
  const [creating, setCreating] = useState(false);
  const [newEvent, setNewEvent] = useState(EVENT_TYPES[0]);
  const [newMatcher, setNewMatcher] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [newTimeout, setNewTimeout] = useState("");

  const fetchHooks = () => {
    apiFetch("/api/hooks").then((r) => r.json()).then((d) => {
      setHooks(d.hooks);
      setMtime(d.mtime);
    });
  };

  const { refresh } = usePolling(fetchHooks);

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

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Hooks</h2>
          <p className="mt-1 text-sm text-gray-500">{events.length} event types</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={refresh} />
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="text-sm border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 rounded-lg px-3 py-1.5 transition-colors"
            >
              + New Hook
            </button>
          )}
        </div>
      </div>

      {creating && (
        <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">New Hook</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Event type</label>
              <select
                value={newEvent}
                onChange={(e) => setNewEvent(e.target.value)}
                className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Matcher (optional)</label>
              <input
                type="text"
                placeholder="e.g. Bash"
                value={newMatcher}
                onChange={(e) => setNewMatcher(e.target.value)}
                className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Command</label>
              <input
                type="text"
                placeholder="e.g. echo $CLAUDE_TOOL_NAME"
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Timeout ms (optional)</label>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={newTimeout}
                onChange={(e) => setNewTimeout(e.target.value)}
                className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
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
              className="px-4 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {events.length === 0 && !creating ? (
        <div className="text-gray-400 text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
          No hooks configured
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(([event, entries]) => (
            <div key={event} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">{event}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {entries.map((entry, i) => (
                  <div key={i} className="px-4 py-3.5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 font-mono text-gray-500">
                          {entry.matcher ?? "*"}
                        </span>
                      </div>
                      {entry.hooks.map((hook, j) => (
                        <div key={j} className="mt-2 text-sm">
                          <code className="font-mono text-gray-700 text-xs sm:text-sm break-all">{hook.command}</code>
                          {hook.timeout && (
                            <span className="ml-2 text-xs text-gray-400">
                              {hook.timeout >= 1000 ? `${hook.timeout / 1000}s` : `${hook.timeout}ms`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => deleteHook(event, i)}
                      className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
