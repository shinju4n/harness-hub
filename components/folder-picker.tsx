"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface FolderPickerProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

interface BrowseResult {
  current: string;
  parent: string;
  folders: { name: string; path: string }[];
  hasClaude: boolean;
}

export function FolderPicker({ onSelect, onClose }: FolderPickerProps) {
  // Start in loading state so the initial effect doesn't have to call setLoading synchronously.
  const [data, setData] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);

  const browse = async (dir?: string) => {
    setLoading(true);
    const params = dir ? `?path=${encodeURIComponent(dir)}` : "";
    const res = await fetch(`/api/browse-folder${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/browse-folder");
      if (!cancelled && res.ok) setData(await res.json());
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" data-folder-picker>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[500px] max-w-[90vw] max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Select Folder</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Current path */}
        <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">{data.current}</p>
          {data.hasClaude && (
            <button
              onClick={() => onSelect(data.current + "/.claude")}
              className="mt-1.5 w-full py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              Select {data.current}/.claude
            </button>
          )}
        </div>

        {/* Folder list */}
        <div className="flex-1 overflow-y-auto">
          {/* Go up */}
          {data.current !== data.parent && (
            <button
              onClick={() => browse(data.parent)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-50 dark:border-gray-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
              ..
            </button>
          )}

          {loading ? (
            <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
          ) : data.folders.length === 0 ? (
            <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-sm">No subfolders</div>
          ) : (
            data.folders.map((folder) => (
              <button
                key={folder.path}
                onClick={() => browse(folder.path)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400 shrink-0">
                  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
                </svg>
                <span className="truncate">{folder.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer: select current */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <button
            onClick={() => onSelect(data.current)}
            className="w-full py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Select this folder
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
