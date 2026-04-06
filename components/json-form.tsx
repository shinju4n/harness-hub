"use client";

import { useState } from "react";

interface JsonFormProps {
  data: Record<string, unknown>;
  readOnlyKeys?: string[];
  onSave: (data: Record<string, unknown>) => void;
}

export function JsonForm({ data, readOnlyKeys = [], onSave }: JsonFormProps) {
  const [formData, setFormData] = useState(data);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const updateField = (key: string, value: string) => {
    setFormData((prev) => {
      try {
        return { ...prev, [key]: JSON.parse(value) };
      } catch {
        return { ...prev, [key]: value };
      }
    });
  };

  const startEditObject = (key: string, value: unknown) => {
    setEditingKey(key);
    setEditBuffer(JSON.stringify(value, null, 2));
    setParseError(null);
  };

  const saveEditObject = (key: string) => {
    try {
      const parsed = JSON.parse(editBuffer);
      setFormData((prev) => ({ ...prev, [key]: parsed }));
      setEditingKey(null);
      setParseError(null);
    } catch (err) {
      setParseError((err as Error).message);
    }
  };

  const cancelEditObject = () => {
    setEditingKey(null);
    setParseError(null);
  };

  return (
    <div className="space-y-3">
      {Object.entries(formData).map(([key, value]) => {
        const isReadOnly = readOnlyKeys.includes(key);
        const isObject = typeof value === "object" && value !== null;
        const isEditing = editingKey === key;

        return (
          <div key={key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{key}</span>
                {isReadOnly && <span className="text-[10px] font-normal text-gray-400 uppercase tracking-wider">read-only</span>}
              </label>
              {isObject && !isReadOnly && !isEditing && (
                <button
                  onClick={() => startEditObject(key, value)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 rounded-md border border-gray-200 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
                  </svg>
                  Edit
                </button>
              )}
            </div>
            {isObject ? (
              isEditing ? (
                <div>
                  <textarea
                    value={editBuffer}
                    onChange={(e) => { setEditBuffer(e.target.value); setParseError(null); }}
                    className="w-full min-h-[200px] rounded-lg border border-gray-200 p-3 text-xs font-mono text-gray-700 leading-relaxed resize-y bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
                    spellCheck={false}
                  />
                  {parseError && (
                    <p className="mt-1 text-xs text-red-500">Invalid JSON: {parseError}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => saveEditObject(key)}
                      className="px-3 py-1 text-xs text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors font-medium"
                    >
                      Apply
                    </button>
                    <button
                      onClick={cancelEditObject}
                      className="px-3 py-1 text-xs text-gray-500 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <pre className="text-xs font-mono text-gray-600 bg-gray-50 p-3 rounded-lg overflow-x-auto leading-relaxed">
                  {JSON.stringify(value, null, 2)}
                </pre>
              )
            ) : (
              <input
                type="text"
                value={String(value)}
                onChange={(e) => updateField(key, e.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
              />
            )}
          </div>
        );
      })}
      <button
        onClick={() => onSave(formData)}
        className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors font-medium"
      >
        Save
      </button>
    </div>
  );
}
