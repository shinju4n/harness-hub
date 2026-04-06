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
  const [addingKey, setAddingKey] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newValueError, setNewValueError] = useState<string | null>(null);

  const updateField = (key: string, value: string) => {
    setFormData((prev) => {
      try {
        return { ...prev, [key]: JSON.parse(value) };
      } catch {
        return { ...prev, [key]: value };
      }
    });
  };

  const deleteField = (key: string) => {
    setFormData((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
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

  const addField = () => {
    if (!newKey.trim()) return;
    if (newKey in formData) {
      setNewValueError("Key already exists");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(newValue);
    } catch {
      parsed = newValue;
    }
    setFormData((prev) => ({ ...prev, [newKey.trim()]: parsed }));
    setNewKey("");
    setNewValue("");
    setNewValueError(null);
    setAddingKey(false);
  };

  return (
    <div className="space-y-3">
      {Object.entries(formData).map(([key, value]) => {
        const isReadOnly = readOnlyKeys.includes(key);
        const isObject = typeof value === "object" && value !== null;
        const isEditing = editingKey === key;

        return (
          <div key={key} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{key}</span>
                {isReadOnly && <span className="text-[10px] font-normal text-gray-400 uppercase tracking-wider">read-only</span>}
              </label>
              <div className="flex items-center gap-1">
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
                {!isReadOnly && (
                  <button
                    onClick={() => deleteField(key)}
                    className="px-2 py-1 text-xs text-gray-400 rounded-md hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            {isObject ? (
              isEditing ? (
                <div>
                  <textarea
                    value={editBuffer}
                    onChange={(e) => { setEditBuffer(e.target.value); setParseError(null); }}
                    className="w-full min-h-[200px] rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-xs font-mono text-gray-700 dark:text-gray-300 leading-relaxed resize-y bg-gray-50/50 dark:bg-gray-800/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
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
                <pre className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto leading-relaxed">
                  {JSON.stringify(value, null, 2)}
                </pre>
              )
            ) : (
              <input
                type="text"
                value={String(value)}
                onChange={(e) => updateField(key, e.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-mono disabled:bg-gray-50 dark:disabled:bg-gray-800/50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
              />
            )}
          </div>
        );
      })}

      {/* Add new field */}
      {addingKey ? (
        <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/30 p-4">
          <div className="space-y-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => { setNewKey(e.target.value); setNewValueError(null); }}
              placeholder="Key name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
              autoFocus
            />
            <textarea
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder='Value (string or JSON, e.g. "hello" or {"key": "value"})'
              className="w-full min-h-[80px] rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
              spellCheck={false}
            />
            {newValueError && (
              <p className="text-xs text-red-500">{newValueError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={addField}
                className="px-3 py-1.5 text-xs text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors font-medium"
              >
                Add
              </button>
              <button
                onClick={() => { setAddingKey(false); setNewKey(""); setNewValue(""); setNewValueError(null); }}
                className="px-3 py-1.5 text-xs text-gray-500 rounded-md hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingKey(true)}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/30 transition-colors"
        >
          + Add field
        </button>
      )}

      <button
        onClick={() => onSave(formData)}
        className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors font-medium"
      >
        Save
      </button>
    </div>
  );
}
