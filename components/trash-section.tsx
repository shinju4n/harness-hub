"use client";

import { useState } from "react";

interface TrashedItem {
  name: string;
  kind: "skill" | "agent";
  deletedAt: number;
  trashId: string;
}

interface TrashSectionProps {
  items: TrashedItem[];
  onRestore: (name: string, kind: string) => void;
  onPermanentDelete: (name: string, kind: string) => void;
}

export function TrashSection({ items, onRestore, onPermanentDelete }: TrashSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100/60 dark:hover:bg-gray-800/80 transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-400 dark:text-gray-500"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            Deleted ({items.length})
          </span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-gray-400 dark:text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded list */}
      {open && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
              Trash is empty
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.trashId}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                      {item.name}
                    </span>
                    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 capitalize">
                      {item.kind}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Deleted {new Date(item.deletedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onRestore(item.name, item.kind)}
                    className="px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => onPermanentDelete(item.name, item.kind)}
                    className="px-2.5 py-1 text-xs border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors"
                  >
                    Delete permanently
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
