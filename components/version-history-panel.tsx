"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useVersionHistoryStore } from "@/stores/version-history-store";

interface Snapshot {
  id: string;
  createdAt: number;
  source: "harness-hub" | "claude-hook" | "external" | "bootstrap" | "restore";
  pinned?: boolean;
}

type FilterTab = "all" | "pinned";

const SOURCE_BADGE: Record<Snapshot["source"], { label: string; cls: string }> = {
  "harness-hub": { label: "harness-hub", cls: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" },
  "claude-hook": { label: "claude-hook", cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400" },
  external: { label: "external", cls: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400" },
  bootstrap: { label: "bootstrap", cls: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400" },
  restore: { label: "restore", cls: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" },
};

function VersionRow({
  snap,
  selected,
  onSelect,
  onPin,
  onRestore,
  onCompare,
}: {
  snap: Snapshot;
  selected: boolean;
  onSelect: () => void;
  onPin: () => void;
  onRestore: () => void;
  onCompare: () => void;
}) {
  const badge = SOURCE_BADGE[snap.source] ?? SOURCE_BADGE["harness-hub"];
  return (
    <div
      onClick={onSelect}
      className={`px-3 py-2.5 cursor-pointer border-b border-gray-100 dark:border-gray-800 transition-colors ${
        selected
          ? "bg-amber-50 dark:bg-amber-950/30"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          className="shrink-0 text-gray-300 dark:text-gray-600 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
          aria-label={snap.pinned ? "Unpin" : "Pin"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={snap.pinned ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={snap.pinned ? "text-amber-500 dark:text-amber-400" : ""}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">
          {new Date(snap.createdAt).toLocaleString()}
        </span>
        <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
      {selected && (
        <div className="flex gap-2 mt-2 pl-5">
          <button
            onClick={(e) => { e.stopPropagation(); onRestore(); }}
            className="px-2.5 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors font-medium"
          >
            Restore
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCompare(); }}
            className="px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            Compare
          </button>
        </div>
      )}
    </div>
  );
}

interface VersionHistoryPanelProps {
  kind: "skill" | "agent";
  name: string;
}

export function VersionHistoryPanel({ kind, name }: VersionHistoryPanelProps) {
  const { selectSnapshot, closeHistory, selectedSnapshotId, setCompareSnapshot } = useVersionHistoryStore();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<FilterTab>("all");

  const fetchSnapshots = async () => {
    if (!name) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/version-history?action=list&kind=${kind}&name=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, kind]);

  const handlePin = async (snap: Snapshot) => {
    const action = snap.pinned ? "unpin" : "pin";
    await apiFetch("/api/version-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, kind, name, snapshotId: snap.id }),
    });
    fetchSnapshots();
  };

  const handleRestore = async (snap: Snapshot) => {
    await apiFetch("/api/version-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", kind, name, snapshotId: snap.id }),
    });
    fetchSnapshots();
  };

  const handleCompare = (snap: Snapshot) => {
    setCompareSnapshot(snap.id);
  };

  const displayed = tab === "pinned" ? snapshots.filter((s) => s.pinned) : snapshots;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Version History</span>
        <button
          onClick={closeHistory}
          className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close history"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      {/* Filter tabs */}
      <div className="flex gap-0.5 p-2 border-b border-gray-100 dark:border-gray-800">
        {(["all", "pinned"] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-1 text-xs rounded-md capitalize transition-all ${
              tab === t
                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-medium"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-gray-400 dark:text-gray-500">Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-gray-400 dark:text-gray-500">
            {tab === "pinned" ? "No pinned versions" : "No versions yet"}
          </div>
        ) : (
          displayed.map((snap) => (
            <VersionRow
              key={snap.id}
              snap={snap}
              selected={selectedSnapshotId === snap.id}
              onSelect={() => selectSnapshot(snap.id)}
              onPin={() => handlePin(snap)}
              onRestore={() => handleRestore(snap)}
              onCompare={() => handleCompare(snap)}
            />
          ))
        )}
      </div>
    </div>
  );
}
