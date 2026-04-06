"use client";

import { useEffect, useState } from "react";

interface McpServer { command: string; args?: string[]; }

export default function McpPage() {
  const [servers, setServers] = useState<Record<string, McpServer>>({});

  useEffect(() => {
    fetch("/api/mcp").then((r) => r.json()).then((d) => setServers(d.servers));
  }, []);

  const entries = Object.entries(servers);

  if (entries.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">MCP Servers</h2>
        <div className="text-gray-400">No MCP servers configured</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">MCP Servers</h2>
      <div className="space-y-3">
        {entries.map(([name, config]) => (
          <div key={name} className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="font-medium text-gray-900">{name}</h3>
            <div className="mt-2 text-sm text-gray-500 font-mono">
              <p>$ {config.command} {config.args?.join(" ")}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
