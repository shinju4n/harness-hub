"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { JsonForm } from "@/components/json-form";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";

type Tab = "settings" | "claude-md";
type ScopeId = "user" | "project" | "local" | "org";

interface ScopeMeta {
  id: ScopeId;
  label: string;
  description: string;
  filePath: string;
  exists: boolean;
  writable: boolean;
}

interface ScopeContent {
  id: ScopeId;
  filePath: string;
  content: string;
  exists: boolean;
  writable: boolean;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("settings");
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [scopes, setScopes] = useState<ScopeMeta[]>([]);
  const [activeScope, setActiveScope] = useState<ScopeId>("user");
  const [scopeContent, setScopeContent] = useState<ScopeContent | null>(null);

  const fetchSettings = useCallback(() => {
    apiFetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings));
  }, []);

  const fetchScopes = useCallback(async () => {
    const res = await apiFetch("/api/claude-md");
    if (res.ok) {
      const data = await res.json();
      setScopes(data.scopes ?? []);
    }
  }, []);

  const fetchScopeContent = useCallback(async (scope: ScopeId) => {
    const res = await apiFetch(`/api/claude-md?scope=${scope}`);
    if (res.ok) {
      const data = await res.json();
      setScopeContent(data);
    }
  }, []);

  const activeScopeRef = useRef(activeScope);
  activeScopeRef.current = activeScope;

  const refreshAll = useCallback(() => {
    fetchSettings();
    fetchScopes();
    fetchScopeContent(activeScopeRef.current);
  }, [fetchSettings, fetchScopes, fetchScopeContent]);

  const { refresh } = usePolling(refreshAll);

  const handleScopeChange = (next: ScopeId) => {
    setActiveScope(next);
    fetchScopeContent(next);
  };

  useEffect(() => {
    fetchScopeContent(activeScopeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveClaudeMd = async (content: string) => {
    if (!scopeContent || !scopeContent.writable) return;
    const res = await apiFetch("/api/claude-md", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: activeScope, content }),
    });
    if (res.ok) {
      setScopeContent({ ...scopeContent, content, exists: true });
      fetchScopes();
    }
  };

  const currentScopeMeta = scopes.find((s) => s.id === activeScope);
  const isReadOnly = scopeContent ? !scopeContent.writable : false;

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Global Claude Code configuration</p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1 w-fit mb-6">
        <button
          onClick={() => setTab("settings")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all ${
            tab === "settings" ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm font-medium" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          settings.json
        </button>
        <button
          onClick={() => setTab("claude-md")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all ${
            tab === "claude-md" ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm font-medium" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
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
              await apiFetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "settings", content: data }),
              });
            }}
          />
          <div className="mt-4 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
            Hooks are managed on the <a href="/hooks" className="font-medium underline underline-offset-2">Hooks page</a>.
          </div>
        </div>
      )}

      {tab === "claude-md" && (
        <div className="space-y-4">
          {/* Scope selector */}
          <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1 w-fit">
            {scopes.map((s) => {
              const active = s.id === activeScope;
              return (
                <button
                  key={s.id}
                  onClick={() => handleScopeChange(s.id)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1.5 ${
                    active
                      ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm font-medium"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {s.label}
                  {s.exists ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="File exists" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" title="File not found" />
                  )}
                  {!s.writable && (
                    <span className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-gray-500">RO</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Scope metadata */}
          {currentScopeMeta && (
            <div className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/50">
              <p className="text-xs text-gray-600 dark:text-gray-400">{currentScopeMeta.description}</p>
              <p className="mt-1 text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate" title={currentScopeMeta.filePath}>
                {currentScopeMeta.filePath}
              </p>
              {!currentScopeMeta.exists && (
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                  File does not exist yet{currentScopeMeta.writable ? " — saving will create it" : ""}.
                </p>
              )}
            </div>
          )}

          {/* Editor */}
          {scopeContent && (
            <MarkdownViewer
              key={activeScope}
              content={scopeContent.content}
              fileName={`CLAUDE.md (${activeScope})`}
              onSave={isReadOnly ? undefined : saveClaudeMd}
            />
          )}
        </div>
      )}
    </div>
  );
}
