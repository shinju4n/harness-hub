"use client";

import { useState } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";

interface RuleItem { name: string; fileName: string; }

export default function RulesPage() {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [selected, setSelected] = useState<{ content: string; name: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");

  const fetchRules = () => {
    apiFetch("/api/rules").then((r) => r.json()).then((d) => setRules(d.items));
  };

  const { refresh } = usePolling(fetchRules);

  const viewRule = async (name: string) => {
    const res = await apiFetch(`/api/rules?name=${name}`);
    if (res.ok) {
      const data = await res.json();
      setSelected({ content: data.content, name });
    }
  };

  const saveRule = async (content: string) => {
    if (!selected) return;
    await apiFetch("/api/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selected.name, content }),
    });
    setSelected({ ...selected, content });
  };

  const createRule = async () => {
    if (!newName.trim()) return;
    const res = await apiFetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), content: newContent }),
    });
    if (res.ok) {
      setCreating(false);
      setNewName("");
      setNewContent("");
      fetchRules();
    }
  };

  const deleteRule = async (name: string) => {
    if (!window.confirm(`Delete rule "${name}"?`)) return;
    const res = await apiFetch(`/api/rules?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (res.ok) {
      if (selected?.name === name) setSelected(null);
      fetchRules();
    }
  };

  const ruleList = (
    <div className="space-y-0.5">
      {rules.map((rule) => (
        <div key={rule.name} className="flex items-center gap-1 group">
          <button
            onClick={() => viewRule(rule.name)}
            className={`flex-1 text-left px-3 py-2 rounded-lg text-[13px] font-mono transition-all ${
              selected?.name === rule.name
                ? "bg-amber-50 text-amber-800 font-medium"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {rule.name}
          </button>
          <button
            onClick={() => deleteRule(rule.name)}
            className="opacity-0 group-hover:opacity-100 shrink-0 text-xs text-red-400 hover:text-red-600 transition-all px-1.5 py-1 rounded hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );

  const createForm = creating ? (
    <div className="mt-3 p-3 border border-amber-200 rounded-lg bg-amber-50/50 space-y-2">
      <input
        type="text"
        placeholder="rule-name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
      />
      <textarea
        placeholder="Content (optional)"
        value={newContent}
        onChange={(e) => setNewContent(e.target.value)}
        rows={3}
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400 resize-none"
      />
      <div className="flex gap-1.5">
        <button
          onClick={createRule}
          className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => { setCreating(false); setNewName(""); setNewContent(""); }}
          className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => setCreating(true)}
      className="mt-3 w-full text-[13px] border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 rounded-lg py-1.5 transition-colors"
    >
      + New Rule
    </button>
  );

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Rules</h2>
          <p className="mt-1 text-sm text-gray-500">{rules.length} conditional rules</p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      {rules.length === 0 && !creating ? (
        <div className="text-gray-400 text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
          <p>No rules found in ~/.claude/rules/</p>
          <button
            onClick={() => setCreating(true)}
            className="mt-4 px-4 py-2 text-sm border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
          >
            + New Rule
          </button>
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="lg:hidden">
            {!selected ? (
              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                {ruleList}
                {createForm}
              </div>
            ) : (
              <div>
                <button onClick={() => setSelected(null)} className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                  Back to list
                </button>
                <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} onSave={saveRule} />
              </div>
            )}
          </div>

          {/* Desktop */}
          <div className="hidden lg:flex gap-6">
            <div className="w-56 shrink-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm self-start sticky top-6">
              {ruleList}
              {createForm}
            </div>
            <div className="flex-1 min-w-0">
              {selected ? (
                <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} onSave={saveRule} />
              ) : (
                <div className="text-gray-400 text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">Select a rule to view</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
