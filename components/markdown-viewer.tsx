"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  content: string;
  /** Full raw file content including frontmatter. When provided, edit mode operates on this instead of just the body. */
  rawContent?: string;
  fileName?: string;
  onSave?: (content: string) => Promise<void>;
}

export function MarkdownViewer({ content, rawContent, fileName, onSave }: MarkdownViewerProps) {
  const editSource = rawContent ?? content;
  const [mode, setMode] = useState<"preview" | "raw" | "edit">("preview");
  const [editContent, setEditContent] = useState(editSource);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    await onSave(editContent);
    setSaving(false);
    setMode("preview");
  };

  const handleCancel = () => {
    setEditContent(editSource);
    setMode("preview");
  };

  const startEdit = () => {
    setEditContent(editSource);
    setMode("edit");
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-4 py-2.5 bg-gray-50/50 dark:bg-gray-800/50 gap-2">
        {fileName ? (
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded truncate max-w-[50%]">
            {fileName}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2 shrink-0">
          {mode === "edit" ? (
            <div className="flex gap-1.5">
              <button
                onClick={handleCancel}
                className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1 text-xs text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
                <button
                  onClick={() => setMode("preview")}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    mode === "preview"
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm font-medium"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setMode("raw")}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    mode === "raw"
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm font-medium"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  Raw
                </button>
              </div>
              {onSave && (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
                  </svg>
                  Edit
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {mode === "edit" ? (
        <div className="p-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full min-h-[400px] sm:min-h-[500px] p-4 font-mono text-sm text-gray-700 dark:text-gray-300 leading-relaxed resize-y rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="p-5 sm:p-6 lg:p-8 overflow-x-auto">
          {mode === "preview" ? (
            <article className="prose prose-gray dark:prose-invert max-w-none break-words prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-2xl prose-h1:border-b prose-h1:border-gray-200 dark:prose-h1:border-gray-700 prose-h1:pb-3 prose-h1:mb-4 prose-h2:text-xl prose-h2:border-b prose-h2:border-gray-100 dark:prose-h2:border-gray-700 prose-h2:pb-2 prose-h2:mt-8 prose-h3:text-lg prose-h3:mt-6 prose-p:text-[15px] prose-p:leading-7 prose-li:text-[15px] prose-li:leading-7 prose-pre:text-[13px] prose-pre:leading-6 prose-code:text-[13px] prose-img:rounded-lg prose-table:text-sm prose-td:py-2 prose-th:py-2 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-a:text-amber-700 dark:prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: ({ children, ...props }) => (
                    <pre className="not-prose relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 overflow-x-auto text-[13px] leading-6 my-4" {...props}>
                      {children}
                    </pre>
                  ),
                  code: ({ children, className, ...props }) => {
                    const isBlock = className?.startsWith("language-");
                    if (isBlock) {
                      return (
                        <code className={`${className} text-gray-700 dark:text-gray-300 font-mono`} {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className="bg-gray-100/80 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-[0.85em] font-medium font-mono px-1.5 py-0.5 rounded-md border border-gray-200/50 dark:border-gray-700" {...props}>
                        {children}
                      </code>
                    );
                  },
                  table: ({ children, ...props }) => (
                    <div className="not-prose my-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      <table className="min-w-full text-sm" {...props}>
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children, ...props }) => (
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700" {...props}>
                      {children}
                    </thead>
                  ),
                  th: ({ children, ...props }) => (
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider" {...props}>
                      {children}
                    </th>
                  ),
                  td: ({ children, ...props }) => (
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700" {...props}>
                      {children}
                    </td>
                  ),
                  blockquote: ({ children, ...props }) => (
                    <blockquote className="not-prose my-4 border-l-4 border-amber-400 bg-amber-50/50 dark:bg-amber-950/30 rounded-r-lg px-4 py-3 text-[15px] text-gray-700 dark:text-gray-300 leading-7 [&>p]:m-0" {...props}>
                      {children}
                    </blockquote>
                  ),
                  hr: (props) => (
                    <hr className="not-prose my-6 border-gray-200 dark:border-gray-700" {...props} />
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
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-3 mb-4 mt-0 first:mt-0" {...props}>
                      {children}
                    </h1>
                  ),
                  h2: ({ children, ...props }) => (
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-2 mb-3 mt-8 first:mt-0" {...props}>
                      {children}
                    </h2>
                  ),
                  h3: ({ children, ...props }) => (
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2 first:mt-0" {...props}>
                      {children}
                    </h3>
                  ),
                  a: ({ children, href, ...props }) => (
                    <a href={href} className="text-amber-700 dark:text-amber-400 font-medium hover:underline underline-offset-2" {...props}>
                      {children}
                    </a>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </article>
          ) : (
            <pre className="text-xs sm:text-sm font-mono text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
              {content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
