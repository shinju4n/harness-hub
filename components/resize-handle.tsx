"use client";

import { Separator } from "react-resizable-panels";

/**
 * Shared vertical resize handle for two- and three-column page layouts.
 * Mirrors the visual treatment used in the Memory page so resize affordance
 * is consistent across the app: a thin neutral pill that brightens to amber
 * on hover.
 */
export function ResizeHandle() {
  return (
    <Separator
      className="group w-2 flex items-center justify-center hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors rounded"
      aria-label="Resize panel"
    >
      <div className="w-0.5 h-8 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-amber-400 dark:group-hover:bg-amber-500 transition-colors" />
    </Separator>
  );
}
