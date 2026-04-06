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
      <div className="mb-6 pl-10 lg:pl-0">
        <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        <p className="mt-1 text-sm text-gray-500">Global Claude Code configuration</p>
      </div>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit mb-6">
        <button
          onClick={() => setTab("settings")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all ${
            tab === "settings" ? "bg-white text-gray-900 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          settings.json
        </button>
        <button
          onClick={() => setTab("claude-md")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all ${
            tab === "claude-md" ? "bg-white text-gray-900 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"
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
          <div className="mt-4 p-3 rounded-lg bg-indigo-50/50 border border-indigo-100 text-sm text-indigo-600">
            Hooks are managed on the <a href="/hooks" className="font-medium underline underline-offset-2">Hooks page</a>.
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
                className="w-full h-96 rounded-xl border border-gray-200 p-4 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveClaudeMd}
                  className="px-4 py-2 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 transition-colors font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-gray-500 text-sm rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => { setEditContent(claudeMd); setEditing(true); }}
                className="mb-3 px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors font-medium"
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
