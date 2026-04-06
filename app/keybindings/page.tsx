"use client";

import { useState } from "react";
import { JsonForm } from "@/components/json-form";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";

export default function KeybindingsPage() {
  const [keybindings, setKeybindings] = useState<Record<string, unknown> | null>(null);
  const [exists, setExists] = useState(false);

  const fetchKeybindings = () => {
    apiFetch("/api/keybindings").then((r) => r.json()).then((d) => {
      setKeybindings(d.keybindings);
      setExists(d.exists);
    });
  };

  const { refresh } = usePolling(fetchKeybindings);

  const saveKeybindings = async (data: Record<string, unknown>) => {
    await apiFetch("/api/keybindings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keybindings: data }),
    });
  };

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Keybindings</h2>
          <p className="mt-1 text-sm text-gray-500">Custom keyboard shortcuts for Claude Code</p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      {keybindings === null ? (
        <div className="text-gray-400 pt-12 text-center">Loading...</div>
      ) : (
        <>
          {!exists && (
            <p className="mb-4 text-xs text-gray-400">No keybindings.json found — saving will create it.</p>
          )}
          <JsonForm data={keybindings} onSave={saveKeybindings} />
        </>
      )}
    </div>
  );
}
