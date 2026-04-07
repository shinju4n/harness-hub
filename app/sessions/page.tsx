"use client";

import { useState, useMemo } from "react";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";

interface SessionInfo {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint: string;
  fileName: string;
}

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
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [filter, setFilter] = useState("");

  const fetchSessions = () => {
    apiFetch("/api/sessions").then((r) => r.json()).then((d) => setSessions(d.sessions ?? []));
  };

  const { refresh } = usePolling(fetchSessions);

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

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sessions</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {sessions.length} session{sessions.length === 1 ? "" : "s"} in ~/.claude/sessions/
          </p>
        </div>
        <RefreshButton onRefresh={refresh} />
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
            {filtered.map((s) => (
              <div key={s.fileName} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <code className="font-mono text-[12px] text-gray-700 dark:text-gray-300 truncate">
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
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate" title={s.cwd}>
                      {s.cwd}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
