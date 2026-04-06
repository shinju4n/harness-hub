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
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        {fileName && (
          <span className="text-sm font-mono text-gray-500">{fileName}</span>
        )}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
          <button
            onClick={() => setMode("preview")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mode === "preview"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setMode("raw")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mode === "raw"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Raw
          </button>
        </div>
      </div>
      <div className="p-6">
        {mode === "preview" ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <pre className="text-sm font-mono text-gray-700 whitespace-pre-wrap">{content}</pre>
        )}
      </div>
    </div>
  );
}
