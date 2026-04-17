"use client";

import dynamic from "next/dynamic";

// react-markdown + remark-gfm add ~50-80 KB to the client bundle. Loading
// them lazily means pages that merely link to a markdown viewer (but don't
// render one until user interaction) don't pay that cost on first paint.
export const MarkdownViewer = dynamic(
  () => import("./markdown-viewer").then((m) => m.MarkdownViewer),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[200px] bg-gray-50 dark:bg-gray-950 animate-pulse rounded" />
    ),
  },
);
