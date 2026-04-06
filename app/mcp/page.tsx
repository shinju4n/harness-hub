"use client";

import { useEffect, useState } from "react";

interface McpServer { command: string; args?: string[]; }

export default function McpPage() {
  const [servers, setServers] = useState<Record<string, McpServer>>({});

  useEffect(() => {
    fetch("/api/mcp").then((r) => r.json()).then((d) => setServers(d.servers));
  }, []);

  const entries = Object.entries(servers);

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0">
        <h2 className="text-xl font-semibold text-gray-900">MCP Servers</h2>
        <p className="mt-1 text-sm text-gray-500">{entries.length} configured</p>
      </div>

      {entries.length === 0 ? (
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
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-600 border border-green-200">
                  active
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
