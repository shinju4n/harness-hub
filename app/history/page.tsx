"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshButton } from "@/components/refresh-button";
import { apiFetch } from "@/lib/api-client";

interface HistoryEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId: string;
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

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [project, setProject] = useState<string>("");
  const [projects, setProjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const projectRef = useRef(project);
  projectRef.current = project;

  const fetchPage = useCallback(
    async (nextOffset: number, nextProject: string) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(nextOffset),
        });
        if (nextProject) qs.set("project", nextProject);
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
    []
  );

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/history?projects=1")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setProjects(d.projects ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleProjectChange = (next: string) => {
    setProject(next);
    fetchPage(0, next);
  };

  useEffect(() => {
    fetchPage(0, projectRef.current);
    // Initial load only; subsequent filter changes go through handleProjectChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const e of entries) {
      const day = formatDay(e.timestamp);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return Array.from(map.entries());
  }, [entries]);

  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;
  const currentEnd = Math.min(offset + entries.length, total);

  return (
    <div>
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
      </div>

      {loading && entries.length === 0 ? (
        <div className="text-gray-400 dark:text-gray-500 text-center py-12">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-gray-400 dark:text-gray-500 text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          No history entries
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, list]) => (
            <div key={day} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
              <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400">{day}</h3>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {list.map((e, i) => (
                  <div key={`${e.sessionId}-${e.timestamp}-${i}`} className="px-4 py-2.5">
                    <div className="flex items-start justify-between gap-4">
                      <code className="flex-1 min-w-0 font-mono text-[12px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                        {e.display}
                      </code>
                      <span
                        className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500"
                        title={formatTimestamp(e.timestamp)}
                      >
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {!project && e.project && (
                      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 font-mono truncate">
                        {e.project}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {total > 0 ? `${offset + 1}-${currentEnd} of ${total}` : ""}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => fetchPage(Math.max(0, offset - PAGE_SIZE), project)}
            disabled={!canPrev || loading}
            className="px-3 py-1 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <button
            onClick={() => fetchPage(offset + PAGE_SIZE, project)}
            disabled={!canNext || loading}
            className="px-3 py-1 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
