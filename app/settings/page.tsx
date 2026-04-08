"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { JsonForm } from "@/components/json-form";
import { RefreshButton } from "@/components/refresh-button";
import { FolderPicker } from "@/components/folder-picker";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";

const RECENT_ROOTS_KEY = "harness-hub:recent-project-roots";
const MAX_RECENT = 5;

function loadRecentRoots(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_ROOTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecentRoot(path: string) {
  const prev = loadRecentRoots();
  const next = [path, ...prev.filter((p) => p !== path)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_ROOTS_KEY, JSON.stringify(next));
}

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

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("settings");
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [scopes, setScopes] = useState<ScopeMeta[]>([]);
  const [activeScope, setActiveScope] = useState<ScopeId>("user");
  const [scopeContent, setScopeContent] = useState<ScopeContent | null>(null);
  const [projectRoot, setProjectRoot] = useState<string>("");
  const [projectRootDraft, setProjectRootDraft] = useState<string>("");
  const [projectRootError, setProjectRootError] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showRecents, setShowRecents] = useState(false);
  const [recentRoots, setRecentRoots] = useState<string[]>([]);

  const activeScopeRef = useRef(activeScope);
  activeScopeRef.current = activeScope;
  const projectRootRef = useRef(projectRoot);
  projectRootRef.current = projectRoot;
  const recentsRef = useRef<HTMLDivElement>(null);

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

  const applyProjectRoot = async (overridePath?: string) => {
    const next = (overridePath ?? projectRootDraft).trim();
    if (overridePath !== undefined) setProjectRootDraft(next);
    setProjectRoot(next);
    projectRootRef.current = next;
    setProjectRootError(null);

    if (next) {
      saveRecentRoot(next);
      setRecentRoots(loadRecentRoots());
    }

    // Refetch scope metadata and surface validation failure from the lib
    // layer (non-absolute path, not-a-directory, missing) as an inline
    // error right next to the input instead of hiding it on a disabled tab.
    const params = new URLSearchParams();
    if (next) params.set("projectRoot", next);
    const qs = params.toString();
    const res = await apiFetch(`/api/claude-md${qs ? `?${qs}` : ""}`);
    if (res.ok) {
      const data = await res.json();
      const scopeList: ScopeMeta[] = data.scopes ?? [];
      setScopes(scopeList);
      if (next) {
        const proj = scopeList.find((s) => s.id === "project");
        if (proj && !proj.available && proj.unavailableReason) {
          setProjectRootError(proj.unavailableReason);
        }
      }
    } else {
      const err = await res.json().catch(() => ({ error: "request failed" }));
      setProjectRootError(err.error ?? "request failed");
    }
    await fetchScopeContent(activeScopeRef.current);
  };

  const handleFolderSelect = (path: string) => {
    setShowFolderPicker(false);
    applyProjectRoot(path);
  };

  const clearProjectRoot = async () => {
    setProjectRootDraft("");
    setProjectRoot("");
    projectRootRef.current = "";
    setProjectRootError(null);
    await fetchScopes();
    await fetchScopeContent(activeScopeRef.current);
  };

  // Prefill from query params: ?projectRoot=<path>&tab=claude-md
  useEffect(() => {
    const qpRoot = searchParams.get("projectRoot");
    const qpTab = searchParams.get("tab") as Tab | null;
    if (qpTab === "claude-md") setTab("claude-md");
    if (qpRoot) {
      setProjectRootDraft(qpRoot);
      setProjectRoot(qpRoot);
      projectRootRef.current = qpRoot;
    }
    setRecentRoots(loadRecentRoots());
    fetchScopeContent(activeScopeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close recents dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (recentsRef.current && !recentsRef.current.contains(e.target as Node)) {
        setShowRecents(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
            Hooks are managed on the{" "}
            <a href="/hooks" className="font-medium underline underline-offset-2">
              Hooks page
            </a>
            .
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
              {/* Input + folder icon + recents chevron grouped */}
              <div className="relative flex-1 flex items-stretch rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus-within:border-amber-400">
                <input
                  type="text"
                  value={projectRootDraft}
                  onChange={(e) => setProjectRootDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyProjectRoot();
                  }}
                  placeholder="/absolute/path/to/your/project"
                  className="flex-1 text-[12px] font-mono px-2.5 py-1.5 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none min-w-0 rounded-l-md"
                />
                {/* Folder browse button */}
                <button
                  type="button"
                  onClick={() => setShowFolderPicker(true)}
                  title="Browse folders"
                  className="px-2 text-gray-400 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors border-l border-gray-200 dark:border-gray-700 shrink-0 flex items-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  >
                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                  </svg>
                </button>
                {/* Recents chevron */}
                {recentRoots.length > 0 && (
                  <div className="relative shrink-0" ref={recentsRef}>
                    <button
                      type="button"
                      onClick={() => setShowRecents((v) => !v)}
                      title="Recent project roots"
                      className="px-2 h-full text-gray-400 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors border-l border-gray-200 dark:border-gray-700 flex items-center rounded-r-md"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`transition-transform ${showRecents ? "rotate-180" : ""}`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {showRecents && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                        <p className="px-3 py-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide border-b border-gray-100 dark:border-gray-800">
                          Recent roots
                        </p>
                        {recentRoots.map((root) => (
                          <button
                            key={root}
                            type="button"
                            onClick={() => {
                              setShowRecents(false);
                              applyProjectRoot(root);
                            }}
                            className="w-full text-left px-3 py-2 text-[12px] font-mono text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-700 dark:hover:text-amber-300 transition-colors truncate"
                          >
                            {root}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => applyProjectRoot()}
                className="px-3 py-1.5 text-[12px] font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors shrink-0"
              >
                Apply
              </button>
              {projectRoot && (
                <button
                  onClick={clearProjectRoot}
                  className="px-3 py-1.5 text-[12px] font-medium rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shrink-0"
                >
                  Clear
                </button>
              )}
            </div>
            {projectRootError && (
              <p className="text-[11px] text-red-500 dark:text-red-400">{projectRootError}</p>
            )}
            {projectRoot && !projectRootError && (
              <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate">Active: {projectRoot}</p>
            )}
          </div>

          {/* Folder picker modal */}
          {showFolderPicker && (
            <FolderPicker onSelect={handleFolderSelect} onClose={() => setShowFolderPicker(false)} />
          )}

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

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageInner />
    </Suspense>
  );
}
