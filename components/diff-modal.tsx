"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { VersionDiffView } from "@/components/version-diff-view";

interface DiffModalProps {
  open: boolean;
  oldContents: Record<string, string>;
  newContents: Record<string, string>;
  oldLabel: string;
  newLabel: string;
  onClose: () => void;
  onApply: () => void;
  applying?: boolean;
}

export function DiffModal({
  open,
  oldContents,
  newContents,
  oldLabel,
  newLabel,
  onClose,
  onApply,
  applying = false,
}: DiffModalProps) {
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => closeRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !applying) {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, applying, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99998] flex flex-col bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !applying) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Version diff"
        className="m-4 flex flex-1 flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Version Comparison
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {oldLabel} → {newLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onApply}
              disabled={applying}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            >
              {applying ? "Applying..." : "Apply this version"}
            </button>
            <button
              ref={closeRef}
              onClick={onClose}
              disabled={applying}
              className="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-auto">
          <VersionDiffView
            oldContents={oldContents}
            newContents={newContents}
            oldLabel={oldLabel}
            newLabel={newLabel}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
