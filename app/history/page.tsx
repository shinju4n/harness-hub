"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshButton } from "@/components/refresh-button";
import { useConfirm } from "@/components/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { useToastStore } from "@/stores/toast-store";

interface HistoryEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId: string;
}

type EntryKey = `${number}\0${string}\0${string}`;

function entryKey(e: HistoryEntry): EntryKey {
  return `${e.timestamp}\0${e.sessionId}\0${e.display}`;
}

const PAGE_SIZE = 50;

function formatTimestamp(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function formatDay(ts: number): string {
  if (!ts) return "Unknown";
  return new Date(ts).toLocaleDateString();
}

// Confirmation dialog rendered inline (no external dep).
function BulkDeleteDialog({
  count,
  first,
  last,
  onConfirm,
  onCancel,
}: {
  count: number;
  first: HistoryEntry | null;
  last: HistoryEntry | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const preview = (e: HistoryEntry | null) =>
    e
      ? e.display.length > 80
        ? e.display.slice(0, 80) + "…"
        : e.display
      : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Delete {count} {count === 1 ? "entry" : "entries"}?
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          This action cannot be undone.
        </p>
        {count > 0 && (
          <div className="space-y-2 mb-5">
            {first && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">First entry</p>
                <code className="text-[12px] font-mono text-gray-700 dark:text-gray-300 break-all">
                  {preview(first)}
                </code>
              </div>
            )}
            {last && count > 1 && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">Last entry</p>
                <code className="text-[12px] font-mono text-gray-700 dark:text-gray-300 break-all">
                  {preview(last)}
                </code>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
          >
            Delete {count} {count === 1 ? "entry" : "entries"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryPageInner />
    </Suspense>
  );
}

function HistoryPageInner() {
  const searchParams = useSearchParams();
  const initialSession = searchParams.get("session") ?? "";

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [project, setProject] = useState<string>("");
  const [sessionFilter, setSessionFilter] = useState<string>(initialSession);
  const [projects, setProjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Multi-select state
  const [selected, setSelected] = useState<Set<EntryKey>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const pushToast = useToastStore((s) => s.push);

  const projectRef = useRef(project);
  projectRef.current = project;

  const fetchPage = useCallback(
    async (nextOffset: number, nextProject: string, nextSession?: string) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(nextOffset),
        });
        if (nextProject) qs.set("project", nextProject);
        const sess = nextSession ?? sessionFilter;
        if (sess) qs.set("session", sess);
        const res = await apiFetch(`/api/history?${qs.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries ?? []);
          setTotal(data.total ?? 0);
          setOffset(nextOffset);
        }
      } finally {
        setLoading(false);
      }
    },
    [sessionFilter]
  );

  useEffect(() => {
    let cancelled = false;
    // Fire both initial requests in parallel — projects list is independent
    // of the first page, so there's no reason to stagger them.
    Promise.all([
      apiFetch("/api/history?projects=1").then((r) => r.json()),
    ]).then(([projectsData]) => {
      if (cancelled) return;
      setProjects(projectsData.projects ?? []);
    });
    fetchPage(0, projectRef.current);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProjectChange = (next: string) => {
    setProject(next);
    setSelected(new Set());
    fetchPage(0, next);
  };

  const clearSessionFilter = () => {
    setSessionFilter("");
    setSelected(new Set());
    fetchPage(0, project, "");
  };

  const deleteEntry = async (entry: HistoryEntry) => {
    const preview = entry.display.length > 80 ? entry.display.slice(0, 80) + "…" : entry.display;
    const ok = await confirm({
      title: "Delete history entry",
      message: preview,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await apiFetch("/api/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: entry.timestamp,
        sessionId: entry.sessionId,
        display: entry.display,
      }),
    });
    if (res.ok) {
      pushToast("success", "History entry deleted");
      fetchPage(offset, project);
    } else {
      const err = await res.json().catch(() => ({ error: "delete failed" }));
      pushToast("error", err.error ?? "Failed to delete entry");
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const e of entries) {
      const day = formatDay(e.timestamp);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return Array.from(map.entries());
  }, [entries]);

  // Selection helpers
  const pageKeys = useMemo(() => entries.map(entryKey), [entries]);
  const selectedOnPage = pageKeys.filter((k) => selected.has(k));
  const allOnPageSelected = pageKeys.length > 0 && selectedOnPage.length === pageKeys.length;
  const someOnPageSelected = selectedOnPage.length > 0 && !allOnPageSelected;

  const toggleEntry = (e: HistoryEntry) => {
    const k = entryKey(e);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const k of pageKeys) next.delete(k);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const k of pageKeys) next.add(k);
        return next;
      });
    }
  };

  // Entries corresponding to current selection (in page order).
  const selectedEntries = useMemo(
    () => entries.filter((e) => selected.has(entryKey(e))),
    [entries, selected]
  );

  const handleBulkDelete = async () => {
    if (selectedEntries.length === 0) return;
    setDeleting(true);
    try {
      const predicates = selectedEntries.map((e) => ({
        timestamp: e.timestamp,
        sessionId: e.sessionId,
        display: e.display,
      }));
      const res = await apiFetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predicates }),
      });
      if (res.ok) {
        setSelected(new Set());
        setShowConfirm(false);
        fetchPage(offset, project);
      } else {
        const err = await res.json().catch(() => ({ error: "delete failed" }));
        pushToast("error", err.error ?? "Bulk delete failed");
      }
    } finally {
      setDeleting(false);
    }
  };

  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;
  const currentEnd = Math.min(offset + entries.length, total);

  const firstSelected = selectedEntries[0] ?? null;
  const lastSelected = selectedEntries[selectedEntries.length - 1] ?? null;

  return (
    <div>
      {showConfirm && (
        <BulkDeleteDialog
          count={selectedEntries.length}
          first={firstSelected}
          last={lastSelected}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">History</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {total} total command{total === 1 ? "" : "s"} in ~/.claude/history.jsonl
          </p>
        </div>
        <RefreshButton onRefresh={() => fetchPage(offset, project)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-xs text-gray-500 dark:text-gray-400">Project</label>
        <select
          value={project}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400 max-w-xs"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {sessionFilter && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
              <rect x="2" y="3" width="20" height="14" rx="2" /><path d="m8 21 4-4 4 4" /><path d="M7 8h.01" /><path d="M17 8h.01" />
            </svg>
            Session: {sessionFilter.slice(0, 8)}…
            <button
              onClick={clearSessionFilter}
              className="ml-0.5 p-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
              title="Clear session filter"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </span>
        )}
      </div>

      {/* Sticky selection bar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 mb-3 flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-4 py-2.5 shadow-sm">
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={deleting}
              className="px-3 py-1 text-xs rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div className="text-gray-400 dark:text-gray-500 text-center py-12">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-gray-400 dark:text-gray-500 text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          No history entries
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, list], groupIdx) => (
            <div key={day} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
              {/* Day header with select-all checkbox (only on first group of page) */}
              <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                {groupIdx === 0 && (
                  <label className="flex items-center cursor-pointer" title="Select all on page">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someOnPageSelected;
                      }}
                      onChange={toggleAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 h-3.5 w-3.5"
                    />
                  </label>
                )}
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400">{day}</h3>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {list.map((e, i) => {
                  const k = entryKey(e);
                  const isChecked = selected.has(k);
                  return (
                    <div
                      key={`${e.sessionId}-${e.timestamp}-${i}`}
                      className={`px-4 py-2.5 group flex items-start gap-3 transition-colors ${
                        isChecked ? "bg-amber-50/60 dark:bg-amber-950/40" : ""
                      }`}
                    >
                      <label className="flex items-center pt-0.5 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEntry(e)}
                          className="rounded border-gray-300 dark:border-gray-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 h-3.5 w-3.5"
                        />
                      </label>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <code className="flex-1 min-w-0 font-mono text-[12px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                            {e.display}
                          </code>
                          <div className="flex items-start gap-2 shrink-0">
                            <span
                              className="text-[11px] text-gray-400 dark:text-gray-500"
                              title={formatTimestamp(e.timestamp)}
                            >
                              {new Date(e.timestamp).toLocaleTimeString()}
                            </span>
                            <button
                              onClick={() => deleteEntry(e)}
                              className="text-[11px] text-gray-300 dark:text-gray-700 hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 focus-visible:text-red-500 transition-all px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {!project && e.project && (
                          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 font-mono truncate">
                            {e.project}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {total > 0
            ? `Showing ${offset + 1}–${currentEnd} of ${total.toLocaleString()} ${total === 1 ? "entry" : "entries"}`
            : ""}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSelected(new Set());
              fetchPage(Math.max(0, offset - PAGE_SIZE), project);
            }}
            disabled={!canPrev || loading}
            className="px-3 py-1 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <button
            onClick={() => {
              setSelected(new Set());
              fetchPage(offset + PAGE_SIZE, project);
            }}
            disabled={!canNext || loading}
            className="px-3 py-1 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
