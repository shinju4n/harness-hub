"use client";

import { useEffect, useState } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { JsonForm } from "@/components/json-form";

type Tab = "settings" | "claude-md";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("settings");
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [claudeMd, setClaudeMd] = useState("");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      setSettings(d.settings);
      setClaudeMd(d.claudeMd);
    });
  }, []);

  const saveClaudeMd = async () => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "claude-md", content: editContent }),
    });
    setClaudeMd(editContent);
    setEditing(false);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Settings</h2>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 w-fit mb-6">
        <button
          onClick={() => setTab("settings")}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
            tab === "settings" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          settings.json
        </button>
        <button
          onClick={() => setTab("claude-md")}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
            tab === "claude-md" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          CLAUDE.md
        </button>
      </div>

      {tab === "settings" && settings && (
        <div>
          <JsonForm
            data={settings}
            readOnlyKeys={["hooks"]}
            onSave={async (data) => {
              await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "settings", content: data }),
              });
            }}
          />
          <div className="mt-4 p-3 rounded-lg bg-gray-50 text-sm text-gray-500">
            Hooks are managed on the <a href="/hooks" className="text-blue-500 underline">Hooks page</a>.
          </div>
        </div>
      )}

      {tab === "claude-md" && (
        <div>
          {editing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-96 rounded-xl border border-gray-200 p-4 font-mono text-sm resize-y"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveClaudeMd}
                  className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-gray-500 text-sm rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => { setEditContent(claudeMd); setEditing(true); }}
                className="mb-3 px-4 py-2 text-sm text-gray-500 rounded-lg hover:bg-gray-100"
              >
                Edit
              </button>
              <MarkdownViewer content={claudeMd} fileName="CLAUDE.md" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
