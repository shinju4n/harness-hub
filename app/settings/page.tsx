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
  available: boolean;
  unavailableReason?: string;
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
  const [projectRoot, setProjectRoot] = useState<string>("");
  const [projectRootDraft, setProjectRootDraft] = useState<string>("");

  const activeScopeRef = useRef(activeScope);
  activeScopeRef.current = activeScope;
  const projectRootRef = useRef(projectRoot);
  projectRootRef.current = projectRoot;

  const fetchSettings = useCallback(() => {
    apiFetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings));
  }, []);

  const scopeQuery = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams(extra);
    if (projectRootRef.current) params.set("projectRoot", projectRootRef.current);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, []);

  const fetchScopes = useCallback(async () => {
    const res = await apiFetch(`/api/claude-md${scopeQuery()}`);
    if (res.ok) {
      const data = await res.json();
      setScopes(data.scopes ?? []);
    }
  }, [scopeQuery]);

  const fetchScopeContent = useCallback(
    async (scope: ScopeId) => {
      const res = await apiFetch(`/api/claude-md${scopeQuery({ scope })}`);
      if (res.ok) {
        const data = await res.json();
        setScopeContent(data);
      } else {
        setScopeContent(null);
      }
    },
    [scopeQuery]
  );

  const refreshAll = useCallback(() => {
    fetchSettings();
    fetchScopes();
    fetchScopeContent(activeScopeRef.current);
  }, [fetchSettings, fetchScopes, fetchScopeContent]);

  const { refresh } = usePolling(refreshAll);

  const handleScopeChange = (next: ScopeId) => {
    const scope = scopes.find((s) => s.id === next);
    if (scope && !scope.available) return;
    setActiveScope(next);
    fetchScopeContent(next);
  };

  const applyProjectRoot = async () => {
    const next = projectRootDraft.trim();
    setProjectRoot(next);
    projectRootRef.current = next;
    await fetchScopes();
    await fetchScopeContent(activeScopeRef.current);
  };

  useEffect(() => {
    fetchScopeContent(activeScopeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveClaudeMd = async (content: string) => {
    if (!scopeContent || !scopeContent.writable) return;
    const body: Record<string, unknown> = { scope: activeScope, content };
    if (projectRoot) body.projectRoot = projectRoot;
    const res = await apiFetch("/api/claude-md", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
              const disabled = !s.available;
              return (
                <button
                  key={s.id}
                  onClick={() => handleScopeChange(s.id)}
                  disabled={disabled}
                  title={s.unavailableReason}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1.5 ${
                    active
                      ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm font-medium"
                      : disabled
                        ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {s.label}
                  {s.available && s.exists ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="File exists" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" title="File not found" />
                  )}
                  {!s.writable && s.available && (
                    <span className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-gray-500">RO</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Project root input — required for project/local scopes */}
          <div className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/50 space-y-1.5">
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Project root (required for Project / Local scopes)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={projectRootDraft}
                onChange={(e) => setProjectRootDraft(e.target.value)}
                placeholder="/absolute/path/to/your/project"
                className="flex-1 text-[12px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={applyProjectRoot}
                className="px-3 py-1.5 text-[12px] font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                Apply
              </button>
            </div>
            {projectRoot && (
              <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate">Active: {projectRoot}</p>
            )}
          </div>

          {/* Scope metadata */}
          {currentScopeMeta && (
            <div className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/50">
              <p className="text-xs text-gray-600 dark:text-gray-400">{currentScopeMeta.description}</p>
              {currentScopeMeta.available ? (
                <>
                  <p className="mt-1 text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate" title={currentScopeMeta.filePath}>
                    {currentScopeMeta.filePath}
                  </p>
                  {!currentScopeMeta.exists && (
                    <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                      File does not exist yet{currentScopeMeta.writable ? " — saving will create it" : ""}.
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                  Unavailable: {currentScopeMeta.unavailableReason}
                </p>
              )}
            </div>
          )}

          {/* Editor */}
          {scopeContent && currentScopeMeta?.available && (
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
