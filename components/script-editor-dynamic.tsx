"use client";

import dynamic from "next/dynamic";

export const ScriptEditorDynamic = dynamic(
  () => import("./script-editor").then((m) => m.ScriptEditor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[400px] bg-gray-50 dark:bg-gray-950 animate-pulse rounded" />
    ),
  }
);
