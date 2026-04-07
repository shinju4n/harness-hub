"use client";

import type { MemoryFile } from "@/lib/memory-ops";

interface MemoryListProps {
  memories: MemoryFile[];
  selectedFile: string | null;
  onSelect: (memory: MemoryFile) => void;
}

const typeBadge: Record<string, string> = {
  user: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
  feedback: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300",
  project: "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300",
  reference: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300",
  unknown: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

export function MemoryList({ memories, selectedFile, onSelect }: MemoryListProps) {
  if (memories.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-400">
        No memory files
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {memories.map((m) => (
        <button
          key={m.fileName}
          onClick={() => onSelect(m)}
          className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-all ${
            selectedFile === m.fileName
              ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                typeBadge[m.type] ?? typeBadge.unknown
              }`}
            >
              {m.type}
            </span>
            <span className="truncate">{m.name ?? m.fileName}</span>
          </div>
          {m.description && (
            <p className="text-[11px] text-gray-400 dark:text-gray-400 mt-0.5 line-clamp-1 pl-0.5">
              {m.description}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
