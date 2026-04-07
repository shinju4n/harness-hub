"use client";

import type { MemoryFile } from "@/lib/memory-types";
import { computeMemoryIndexStats } from "@/lib/memory-index-stats";

interface MemoryListProps {
  memories: MemoryFile[];
  selectedFile: string | null;
  onSelect: (memory: MemoryFile) => void;
  memoryIndex?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function IndexSection({ memoryIndex }: { memoryIndex: string | null | undefined }) {
  const stats = computeMemoryIndexStats(memoryIndex ?? null);
  if (!stats.exists) return null;

  const worstPct = Math.max(stats.linePct, stats.bytePct);
  const over = stats.overLineLimit || stats.overByteLimit;
  const barColor = over
    ? "bg-red-500"
    : worstPct >= 80
      ? "bg-amber-500"
      : "bg-green-500";
  const barWidth = Math.min(100, worstPct);

  return (
    <div className="mb-3 px-3 py-2.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-amber-500 text-white">
          auto-loaded
        </span>
        <span className="text-[12px] font-semibold text-amber-900 dark:text-amber-200">MEMORY.md</span>
      </div>
      <p className="text-[10px] text-amber-700 dark:text-amber-400 mb-2 leading-snug">
        Loaded at session start. Limits: 200 lines / 25 KB.
      </p>
      <div className="h-1 rounded-full bg-amber-100 dark:bg-amber-950 overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${barWidth}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-amber-800 dark:text-amber-300">
        <span className={stats.overLineLimit ? "text-red-600 dark:text-red-400 font-semibold" : ""}>
          {stats.lines} / 200 lines
        </span>
        <span className={stats.overByteLimit ? "text-red-600 dark:text-red-400 font-semibold" : ""}>
          {formatBytes(stats.bytes)} / 25 KB
        </span>
      </div>
    </div>
  );
}

const typeBadge: Record<string, string> = {
  user: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
  feedback: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300",
  project: "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300",
  reference: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300",
  unknown: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

export function MemoryList({ memories, selectedFile, onSelect, memoryIndex }: MemoryListProps) {
  if (memories.length === 0 && !memoryIndex) {
    return (
      <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-400">
        No memory files
      </p>
    );
  }

  return (
    <div>
      <IndexSection memoryIndex={memoryIndex} />
      {memories.length > 0 && (
        <p className="px-3 pt-1 pb-2 text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500">
          On-demand topics
        </p>
      )}
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
            <span className="truncate flex-1">{m.name ?? m.fileName}</span>
            <span
              className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
              title="Loaded on-demand during the conversation"
            >
              on-demand
            </span>
          </div>
          {m.description && (
            <p className="text-[11px] text-gray-400 dark:text-gray-400 mt-0.5 line-clamp-1 pl-0.5">
              {m.description}
            </p>
          )}
        </button>
      ))}
    </div>
    </div>
  );
}
