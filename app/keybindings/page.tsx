"use client";

import { useEffect, useState } from "react";
import { JsonForm } from "@/components/json-form";

export default function KeybindingsPage() {
  const [keybindings, setKeybindings] = useState<Record<string, unknown> | null>(null);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    fetch("/api/keybindings").then((r) => r.json()).then((d) => {
      setKeybindings(d.keybindings);
      setExists(d.exists);
    });
  }, []);

  const saveKeybindings = async (data: Record<string, unknown>) => {
    await fetch("/api/keybindings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keybindings: data }),
    });
  };

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0">
        <h2 className="text-xl font-semibold text-gray-900">Keybindings</h2>
        <p className="mt-1 text-sm text-gray-500">Custom keyboard shortcuts for Claude Code</p>
      </div>

      {!exists ? (
        <div className="text-gray-400 text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
          <p>No keybindings.json found</p>
          <p className="text-xs mt-1">Add keybindings to create the file</p>
        </div>
      ) : keybindings ? (
        <JsonForm data={keybindings} onSave={saveKeybindings} />
      ) : (
        <div className="text-gray-400 pt-12 text-center">Loading...</div>
      )}
    </div>
  );
}
