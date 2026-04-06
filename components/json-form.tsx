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
    <div className="space-y-3">
      {Object.entries(formData).map(([key, value]) => {
        const isReadOnly = readOnlyKeys.includes(key);
        return (
          <div key={key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{key}</span>
              {isReadOnly && <span className="text-[10px] font-normal text-gray-400 uppercase tracking-wider">read-only</span>}
            </label>
            {typeof value === "object" ? (
              <pre className="text-xs font-mono text-gray-600 bg-gray-50 p-3 rounded-lg overflow-x-auto leading-relaxed">
                {JSON.stringify(value, null, 2)}
              </pre>
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
