"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshButton } from "@/components/refresh-button";
import { useConfirm } from "@/components/confirm-dialog";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";
import { useToastStore } from "@/stores/toast-store";

interface SessionInfo {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint: string;
  fileName: string;
}

interface BulkDeleteResult {
  deleted: number;
  oldest: number | null;
  newest: number | null;
}

const CLEANUP_OPTIONS = [
  { label: "Delete sessions older than 1 day", olderThanMs: 86_400_000 },
  { label: "Delete sessions older than 7 days", olderThanMs: 7 * 86_400_000 },
  { label: "Delete sessions older than 30 days", olderThanMs: 30 * 86_400_000 },
  { label: "Delete all sessions", olderThanMs: null },
] as const;

function formatRelative(ts: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function formatAbsolute(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Cleanup dropdown state
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const cleanupRef = useRef<HTMLDivElement>(null);

  // Confirm modal state
  const [confirmOption, setConfirmOption] = useState<(typeof CLEANUP_OPTIONS)[number] | null>(null);
  const [previewData, setPreviewData] = useState<BulkDeleteResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Hover state for cwd actions
  const [hoveredCwd, setHoveredCwd] = useState<string | null>(null);

  const { confirm, dialog: confirmDialog } = useConfirm();
  const pushToast = useToastStore((s) => s.push);

  const fetchSessions = () => {
    apiFetch("/api/sessions").then((r) => r.json()).then((d) => setSessions(d.sessions ?? []));
  };

  const { refresh } = usePolling(fetchSessions);

  // Close cleanup dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cleanupRef.current && !cleanupRef.current.contains(e.target as Node)) {
        setCleanupOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.sessionId.toLowerCase().includes(q) ||
        s.cwd.toLowerCase().includes(q) ||
        String(s.pid).includes(q)
    );
  }, [sessions, filter]);

  const deleteSession = async (fileName: string) => {
    const ok = await confirm({
      title: "Delete session metadata",
      message:
        `"${fileName}" will be removed from ~/.claude/sessions/.\n\nThis only deletes the metadata file. The running Claude Code process — if any — is not affected.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await apiFetch(`/api/sessions?file=${encodeURIComponent(fileName)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      pushToast("success", "Session metadata deleted");
      if (expanded === fileName) setExpanded(null);
      fetchSessions();
    } else {
      const err = await res.json().catch(() => ({ error: "delete failed" }));
      pushToast("error", err.error ?? "Failed to delete session");
    }
  };

  const openCleanupConfirm = async (option: (typeof CLEANUP_OPTIONS)[number]) => {
    setCleanupOpen(false);
    setConfirmOption(option);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const res = await apiFetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanMs: option.olderThanMs, dryRun: true }),
      });
      const data: BulkDeleteResult = await res.json();
      setPreviewData(data);
    } catch {
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (!confirmOption) return;
    setDeleting(true);
    try {
      await apiFetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanMs: confirmOption.olderThanMs, dryRun: false }),
      });
      setConfirmOption(null);
      setPreviewData(null);
      fetchSessions();
    } catch {
      pushToast("error", "Bulk delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sessions</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {sessions.length} session{sessions.length === 1 ? "" : "s"} in ~/.claude/sessions/
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Cleanup dropdown */}
          <div className="relative" ref={cleanupRef}>
            <button
              onClick={() => setCleanupOpen((v) => !v)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
              Cleanup
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 transition-transform ${cleanupOpen ? "rotate-180" : ""}`}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {cleanupOpen && (
              <div className="absolute right-0 mt-1 w-60 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-20 py-1">
                {CLEANUP_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => openCleanupConfirm(opt)}
                    className="w-full text-left text-sm px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-950 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <RefreshButton onRefresh={refresh} />
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Filter by sessionId, cwd, or pid..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full sm:max-w-sm text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-gray-400 dark:text-gray-500 text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          {sessions.length === 0 ? "No sessions found" : "No sessions match filter"}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {filtered.map((s) => {
              const isOpen = expanded === s.fileName;
              return (
                <div key={s.fileName}>
                  <div className="px-4 py-3.5 group">
                    <div className="flex items-start justify-between gap-4">
                      <button
                        onClick={() => setExpanded(isOpen ? null : s.fileName)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                          >
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                          <code className="font-mono text-[12px] text-gray-700 dark:text-gray-300 truncate" title={s.sessionId}>
                            {s.sessionId}
                          </code>
                          {s.kind && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                              {s.kind}
                            </span>
                          )}
                          {s.entrypoint && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                              {s.entrypoint}
                            </span>
                          )}
                        </div>
                        {/* Part B — cwd with hover action icons */}
                        <div
                          className="flex items-center gap-1.5 pl-5"
                          onMouseEnter={() => setHoveredCwd(s.fileName)}
                          onMouseLeave={() => setHoveredCwd(null)}
                        >
                          <p
                            className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate"
                            title={s.cwd}
                          >
                            {s.cwd}
                          </p>
                          {hoveredCwd === s.fileName && s.cwd && (
                            <span className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                title="View history for this project"
                                onClick={() => router.push(`/history?project=${encodeURIComponent(s.cwd)}`)}
                                className="p-0.5 rounded text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                              </button>
                              <button
                                title="Use as CLAUDE.md project root"
                                onClick={() => router.push(`/settings?tab=claude-md&projectRoot=${encodeURIComponent(s.cwd)}`)}
                                className="p-0.5 rounded text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <line x1="16" y1="13" x2="8" y2="13" />
                                  <line x1="16" y1="17" x2="8" y2="17" />
                                  <polyline points="10 9 9 9 8 9" />
                                </svg>
                              </button>
                              <button
                                title="Copy path"
                                onClick={() => navigator.clipboard.writeText(s.cwd)}
                                className="p-0.5 rounded text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              </button>
                            </span>
                          )}
                        </div>
                      </button>
                      <div className="flex items-start gap-3 shrink-0">
                        <div className="text-right">
                          <div
                            className="text-xs text-gray-600 dark:text-gray-400"
                            title={formatAbsolute(s.startedAt)}
                          >
                            {formatRelative(s.startedAt)}
                          </div>
                          <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                            pid {s.pid}
                          </div>
                        </div>
                        {/* Part C — a11y delete button */}
                        <button
                          onClick={() => deleteSession(s.fileName)}
                          className="text-xs text-gray-300 dark:text-gray-700 hover:text-red-500 dark:hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 focus-visible:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-4 pb-4 pl-9">
                      <pre className="text-[11px] font-mono bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-md p-3 overflow-x-auto text-gray-700 dark:text-gray-300">
{JSON.stringify(s, null, 2)}
                      </pre>
                      <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                        ~/.claude/sessions/{s.fileName}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Part A — Confirm modal */}
      {confirmOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {confirmOption.label}
            </h3>
            {previewLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Calculating…</p>
            ) : previewData ? (
              <div className="mt-3 space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  Will delete{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {previewData.deleted}
                  </span>{" "}
                  session file{previewData.deleted === 1 ? "" : "s"}.
                </p>
                {previewData.oldest !== null && (
                  <p className="text-xs">
                    Oldest: {formatAbsolute(previewData.oldest)}
                  </p>
                )}
                {previewData.newest !== null && (
                  <p className="text-xs">
                    Newest: {formatAbsolute(previewData.newest)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-500 mt-3">Failed to load preview.</p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setConfirmOption(null); setPreviewData(null); }}
                className="px-4 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDelete}
                disabled={deleting || previewLoading || (previewData?.deleted ?? 0) === 0}
                className="px-4 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
