"use client";

import { useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

interface DiffViewProps {
  oldContents: Record<string, string>;
  newContents: Record<string, string>;
  oldLabel: string;
  newLabel: string;
}

const MAX_EAGER_FILES = 50;

export function VersionDiffView({ oldContents, newContents, oldLabel, newLabel }: DiffViewProps) {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  // Collect all file names from both sides
  const allFiles = Array.from(new Set([...Object.keys(oldContents), ...Object.keys(newContents)]));
  const changedFiles = allFiles.filter((f) => (oldContents[f] ?? "") !== (newContents[f] ?? ""));
  const [selectedFile, setSelectedFile] = useState<string>(changedFiles[0] ?? allFiles[0] ?? "");
  const [lazyLoaded, setLazyLoaded] = useState<Set<string>>(new Set());

  const tooManyFiles = allFiles.length > MAX_EAGER_FILES;

  const shouldRender = (file: string) =>
    !tooManyFiles || lazyLoaded.has(file) || file === selectedFile;

  const styles = {
    variables: {
      dark: {
        diffViewerBackground: "#111827",
        addedBackground: "#052e16",
        addedColor: "#86efac",
        removedBackground: "#450a0a",
        removedColor: "#fca5a5",
        wordAddedBackground: "#14532d",
        wordRemovedBackground: "#7f1d1d",
        addedGutterBackground: "#052e16",
        removedGutterBackground: "#450a0a",
        gutterBackground: "#1f2937",
        gutterBackgroundDark: "#111827",
        gutterColor: "#6b7280",
        codeFoldBackground: "#1f2937",
        emptyLineBackground: "#111827",
        codeFoldContentColor: "#9ca3af",
      },
      light: {
        diffViewerBackground: "#ffffff",
        gutterBackground: "#f9fafb",
        codeFoldBackground: "#f3f4f6",
        codeFoldContentColor: "#6b7280",
      },
    },
    line: {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "12px",
    },
  };

  return (
    <div className="flex h-full rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* File rail */}
      <div className="w-48 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
        <div className="px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-800">
          Files ({changedFiles.length} changed)
        </div>
        {allFiles.map((file) => {
          const changed = changedFiles.includes(file);
          return (
            <button
              key={file}
              onClick={() => {
                setSelectedFile(file);
                if (tooManyFiles) setLazyLoaded((prev) => new Set([...prev, file]));
              }}
              className={`w-full text-left px-2 py-1.5 text-xs truncate transition-colors flex items-center gap-1.5 ${
                file === selectedFile
                  ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {changed && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${file === selectedFile ? "bg-amber-500" : "bg-amber-400"}`} />
              )}
              <span className="truncate">{file}</span>
            </button>
          );
        })}
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-950 text-sm">
        {tooManyFiles && !lazyLoaded.has(selectedFile) && selectedFile && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-gray-500 dark:text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Large changeset ({allFiles.length} files). Click to load diff for <strong>{selectedFile}</strong>.</span>
            <button
              onClick={() => setLazyLoaded((prev) => new Set([...prev, selectedFile]))}
              className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors"
            >
              Load diff
            </button>
          </div>
        )}

        {shouldRender(selectedFile) && selectedFile && (
          <ReactDiffViewer
            oldValue={oldContents[selectedFile] ?? ""}
            newValue={newContents[selectedFile] ?? ""}
            leftTitle={`${oldLabel} — ${selectedFile}`}
            rightTitle={`${newLabel} — ${selectedFile}`}
            splitView={true}
            compareMethod={DiffMethod.WORDS}
            useDarkTheme={isDark}
            styles={styles}
          />
        )}

        {!selectedFile && (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400 dark:text-gray-500">
            Select a file to view diff
          </div>
        )}
      </div>
    </div>
  );
}
