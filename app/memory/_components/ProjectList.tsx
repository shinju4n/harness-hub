"use client";

import { useState } from "react";
import type { MemoryProject } from "@/lib/memory-ops";

interface ProjectListProps {
  projects: MemoryProject[];
  selectedId: string | null;
  onSelect: (project: MemoryProject) => void;
}

export function ProjectList({ projects, selectedId, onSelect }: ProjectListProps) {
  const [showEmpty, setShowEmpty] = useState(false);

  const filtered = showEmpty ? projects : projects.filter((p) => p.memoryCount > 0);

  if (projects.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        No projects found in ~/.claude/projects/
      </p>
    );
  }

  return (
    <div>
      <label className="flex items-center gap-2 px-3 py-2 text-[11px] text-gray-400 dark:text-gray-500 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showEmpty}
          onChange={(e) => setShowEmpty(e.target.checked)}
          className="rounded border-gray-300 dark:border-gray-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 h-3.5 w-3.5"
        />
        Show empty projects
      </label>

      <div className="space-y-0.5">
        {filtered.map((p) => {
          const segments = p.id.split("-").filter(Boolean);
          const shortName = segments.slice(-1)[0] ?? p.id;

          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-all ${
                selectedId === p.id
                  ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`shrink-0 w-2 h-2 rounded-full ${
                    p.memoryCount > 0
                      ? "bg-amber-500"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
                <span className="truncate">{shortName}</span>
                <span className="ml-auto shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                  {p.memoryCount}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 ml-4 truncate font-mono" title={p.id}>
                {p.id}
              </p>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-[12px] text-gray-400 dark:text-gray-500">
            No projects with memories
          </p>
        )}
      </div>
    </div>
  );
}
