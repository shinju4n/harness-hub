"use client";

import { useEffect, useState } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";
import type { MemoryFile } from "@/lib/memory-ops";

interface MemoryEditorProps {
  memory: MemoryFile;
  onSave: (data: { name: string; description: string; type: string; body: string; mtime: string }) => Promise<void>;
  onDelete: (fileName: string) => void;
}

const TYPES = ["user", "feedback", "project", "reference"] as const;

export function MemoryEditor({ memory, onSave, onDelete }: MemoryEditorProps) {
  const [name, setName] = useState(memory.name ?? "");
  const [description, setDescription] = useState(memory.description ?? "");
  const [type, setType] = useState(memory.type);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(memory.name ?? "");
    setDescription(memory.description ?? "");
    setType(memory.type);
  }, [memory.fileName, memory.name, memory.description, memory.type]);

  const handleSaveMetadata = async () => {
    setSaving(true);
    await onSave({ name, description, type, body: memory.body, mtime: memory.mtime });
    setSaving(false);
  };

  const handleSaveBody = async (rawContent: string) => {
    // rawContent is full file content (frontmatter + body) from MarkdownViewer edit mode
    // Strip frontmatter to get body only
    const fmMatch = rawContent.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
    const body = fmMatch ? fmMatch[1].trim() : rawContent.trim();
    await onSave({ name, description, type, body, mtime: memory.mtime });
  };

  // Build raw content with frontmatter for MarkdownViewer
  const rawContent = `---\nname: ${memory.name ?? ""}\ndescription: ${memory.description ?? ""}\ntype: ${memory.type}\n---\n\n${memory.body}\n`;

  return (
    <div className="space-y-4">
      {/* Meta card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded truncate max-w-[60%]">
            {memory.fileName}
          </span>
          <button
            onClick={() => onDelete(memory.fileName)}
            className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-300 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MemoryFile["type"])}
              className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
              {memory.type === "unknown" && <option value="unknown">unknown</option>}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          <button
            onClick={handleSaveMetadata}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Metadata"}
          </button>
        </div>
      </div>

      {/* Body viewer/editor */}
      <MarkdownViewer
        content={memory.body}
        rawContent={rawContent}
        fileName={memory.fileName}
        onSave={handleSaveBody}
      />
    </div>
  );
}
