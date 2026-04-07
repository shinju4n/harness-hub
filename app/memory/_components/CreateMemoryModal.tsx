"use client";

import { useState } from "react";

interface CreateMemoryModalProps {
  onSubmit: (data: { fileName: string; name: string; description: string; type: string; body: string }) => Promise<boolean>;
  onClose: () => void;
}

const TYPES = ["user", "feedback", "project", "reference"] as const;

function toFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") + ".md";
}

export function CreateMemoryModal({ onSubmit, onClose }: CreateMemoryModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("user");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileName = name.trim() ? toFileName(name.trim()) : "";

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setError(null);
    setSubmitting(true);
    const ok = await onSubmit({ fileName, name: name.trim(), description: description.trim(), type, body });
    setSubmitting(false);
    if (!ok) setError("Failed to create memory file");
  };

  return (
    <div className="mt-3 p-3 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50/50 dark:bg-amber-950/50 space-y-2">
      <div>
        <input
          type="text"
          placeholder="Memory name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
        />
        {fileName && (
          <p className="mt-1 text-[10px] font-mono text-gray-400 dark:text-gray-500 px-1">
            {fileName}
          </p>
        )}
      </div>

      <input
        type="text"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
      />

      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
      >
        {TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <textarea
        placeholder="Memory content (markdown)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400 resize-none font-mono"
      />

      {error && (
        <p className="text-[12px] text-red-500 dark:text-red-400 px-1">{error}</p>
      )}

      <div className="flex gap-1.5">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create"}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
