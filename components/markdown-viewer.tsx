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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 bg-gray-50/50">
        {fileName ? (
          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded truncate max-w-[60%]">
            {fileName}
          </span>
        ) : (
          <span />
        )}
        <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5 shrink-0">
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

      {/* Content */}
      <div className="p-5 sm:p-6 lg:p-8 overflow-x-auto">
        {mode === "preview" ? (
          <article className="prose prose-gray max-w-none break-words prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-2xl prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-3 prose-h1:mb-4 prose-h2:text-xl prose-h2:border-b prose-h2:border-gray-100 prose-h2:pb-2 prose-h2:mt-8 prose-h3:text-lg prose-h3:mt-6 prose-p:text-[15px] prose-p:leading-7 prose-li:text-[15px] prose-li:leading-7 prose-pre:text-[13px] prose-pre:leading-6 prose-code:text-[13px] prose-img:rounded-lg prose-table:text-sm prose-td:py-2 prose-th:py-2 prose-strong:text-gray-900 prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                pre: ({ children, ...props }) => (
                  <pre className="not-prose relative rounded-xl border border-gray-200 bg-gray-50 p-4 overflow-x-auto text-[13px] leading-6 my-4" {...props}>
                    {children}
                  </pre>
                ),
                code: ({ children, className, ...props }) => {
                  const isBlock = className?.startsWith("language-");
                  if (isBlock) {
                    return (
                      <code className={`${className} text-gray-700 font-mono`} {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className="bg-gray-100/80 text-gray-800 text-[0.85em] font-medium font-mono px-1.5 py-0.5 rounded-md border border-gray-200/50" {...props}>
                      {children}
                    </code>
                  );
                },
                table: ({ children, ...props }) => (
                  <div className="not-prose my-4 overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-sm" {...props}>
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children, ...props }) => (
                  <thead className="bg-gray-50 border-b border-gray-200" {...props}>
                    {children}
                  </thead>
                ),
                th: ({ children, ...props }) => (
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" {...props}>
                    {children}
                  </th>
                ),
                td: ({ children, ...props }) => (
                  <td className="px-3 py-2 text-gray-700 border-t border-gray-100" {...props}>
                    {children}
                  </td>
                ),
                blockquote: ({ children, ...props }) => (
                  <blockquote className="not-prose my-4 border-l-4 border-indigo-400 bg-indigo-50/50 rounded-r-lg px-4 py-3 text-[15px] text-gray-700 leading-7 [&>p]:m-0" {...props}>
                    {children}
                  </blockquote>
                ),
                hr: (props) => (
                  <hr className="not-prose my-6 border-gray-200" {...props} />
                ),
                ul: ({ children, ...props }) => (
                  <ul className="my-3 space-y-1" {...props}>
                    {children}
                  </ul>
                ),
                ol: ({ children, ...props }) => (
                  <ol className="my-3 space-y-1" {...props}>
                    {children}
                  </ol>
                ),
                h1: ({ children, ...props }) => (
                  <h1 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-3 mb-4 mt-0 first:mt-0" {...props}>
                    {children}
                  </h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-3 mt-8 first:mt-0" {...props}>
                    {children}
                  </h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2 first:mt-0" {...props}>
                    {children}
                  </h3>
                ),
                a: ({ children, href, ...props }) => (
                  <a href={href} className="text-indigo-600 font-medium hover:underline underline-offset-2" {...props}>
                    {children}
                  </a>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </article>
        ) : (
          <pre className="text-xs sm:text-sm font-mono text-gray-600 whitespace-pre-wrap leading-relaxed break-words">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
