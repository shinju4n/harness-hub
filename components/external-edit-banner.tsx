"use client";

import { useState } from "react";

interface ExternalEditBannerProps {
  source: string;
  timestamp: number;
  onViewChanges: () => void;
  onRevert: () => void;
}

export function ExternalEditBanner({ source, timestamp, onViewChanges, onRevert }: ExternalEditBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
      {/* Warning icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-amber-500 dark:text-amber-400"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>

      {/* Message */}
      <span className="flex-1 font-medium">
        Modified by <span className="font-semibold">{source}</span>
        {" · "}
        {new Date(timestamp).toLocaleString()}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onViewChanges}
          className="px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors font-medium"
        >
          View changes
        </button>
        <button
          onClick={onRevert}
          className="px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors font-medium"
        >
          Revert
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors ml-0.5"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
