"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  content: string;
  fileName?: string;
}

export function MarkdownViewer({ content, fileName }: MarkdownViewerProps) {
  const [mode, setMode] = useState<"preview" | "raw">("preview");

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 bg-gray-50/50">
        {fileName && (
          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{fileName}</span>
        )}
        <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5">
          <button
            onClick={() => setMode("preview")}
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              mode === "preview"
                ? "bg-white text-gray-900 shadow-sm font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setMode("raw")}
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              mode === "raw"
                ? "bg-white text-gray-900 shadow-sm font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Raw
          </button>
        </div>
      </div>
      <div className="p-5 sm:p-6 lg:p-8">
        {mode === "preview" ? (
          <article className="prose prose-gray prose-sm sm:prose-base max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        ) : (
          <pre className="text-xs sm:text-sm font-mono text-gray-600 whitespace-pre-wrap leading-relaxed">{content}</pre>
        )}
      </div>
    </div>
  );
}
