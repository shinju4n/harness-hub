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

  if (events.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Hooks</h2>
        <div className="text-gray-400">No hooks configured</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Hooks</h2>
      <div className="space-y-4">
        {events.map(([event, entries]) => (
          <div key={event} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700">{event}</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {entries.map((entry, i) => (
                <div key={i} className="px-4 py-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400 font-mono">
                        matcher: {entry.matcher ?? "*"}
                      </span>
                    </div>
                    {entry.hooks.map((hook, j) => (
                      <div key={j} className="mt-2 pl-4 text-sm">
                        <span className="font-mono text-gray-600">{hook.command}</span>
                        {hook.timeout && (
                          <span className="ml-2 text-gray-400">
                            timeout: {hook.timeout}ms
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => deleteHook(event, i)}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
