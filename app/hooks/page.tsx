"use client";

import { useEffect, useState } from "react";

interface HookEntry {
  matcher?: string;
  hooks: Array<{ type: string; command: string; timeout?: number }>;
}

type HooksData = Record<string, HookEntry[]>;

export default function HooksPage() {
  const [hooks, setHooks] = useState<HooksData>({});
  const [mtime, setMtime] = useState<number>(0);

  useEffect(() => {
    fetch("/api/hooks").then((r) => r.json()).then((d) => {
      setHooks(d.hooks);
      setMtime(d.mtime);
    });
  }, []);

  const events = Object.entries(hooks);

  const deleteHook = async (event: string, entryIndex: number) => {
    const updated = { ...hooks };
    updated[event] = updated[event].filter((_, i) => i !== entryIndex);
    if (updated[event].length === 0) delete updated[event];
    const res = await fetch("/api/hooks", {
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

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0">
        <h2 className="text-xl font-semibold text-gray-900">Hooks</h2>
        <p className="mt-1 text-sm text-gray-500">{events.length} event types</p>
      </div>

      {events.length === 0 ? (
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
