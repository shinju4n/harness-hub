"use client";

import { useState } from "react";

interface JsonFormProps {
  data: Record<string, unknown>;
  readOnlyKeys?: string[];
  onSave: (data: Record<string, unknown>) => void;
}

export function JsonForm({ data, readOnlyKeys = [], onSave }: JsonFormProps) {
  const [formData, setFormData] = useState(data);

  const updateField = (key: string, value: string) => {
    setFormData((prev) => {
      try {
        return { ...prev, [key]: JSON.parse(value) };
      } catch {
        return { ...prev, [key]: value };
      }
    });
  };

  return (
    <div className="space-y-4">
      {Object.entries(formData).map(([key, value]) => {
        const isReadOnly = readOnlyKeys.includes(key);
        return (
          <div key={key} className="rounded-lg border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {key}
              {isReadOnly && <span className="ml-2 text-xs text-gray-400">(read-only)</span>}
            </label>
            {typeof value === "object" ? (
              <pre className="text-sm font-mono text-gray-600 bg-gray-50 p-3 rounded-lg">
                {JSON.stringify(value, null, 2)}
              </pre>
            ) : (
              <input
                type="text"
                value={String(value)}
                onChange={(e) => updateField(key, e.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono disabled:bg-gray-50 disabled:text-gray-400"
              />
            )}
          </div>
        );
      })}
      <button
        onClick={() => onSave(formData)}
        className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
      >
        Save
      </button>
    </div>
  );
}
