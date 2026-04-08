"use client";

import { useState } from "react";
import { Panel, Group } from "react-resizable-panels";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { RefreshButton } from "@/components/refresh-button";
import { EmptyState } from "@/components/empty-state";
import { ResizeHandle } from "@/components/resize-handle";
import { useConfirm } from "@/components/confirm-dialog";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";
import { useToastStore } from "@/stores/toast-store";

interface RuleItem { name: string; fileName: string; }

export default function RulesPage() {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [selected, setSelected] = useState<{ content: string; name: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const pushToast = useToastStore((s) => s.push);

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
    const ok = await confirm({
      title: "Delete rule",
      message: `"${name}" will be removed from ~/.claude/rules/. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await apiFetch(`/api/rules?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (res.ok) {
      pushToast("success", `Rule "${name}" deleted`);
      if (selected?.name === name) setSelected(null);
      fetchRules();
    } else {
      const err = await res.json().catch(() => ({}));
      pushToast("error", err.error ?? `Failed to delete "${name}"`);
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
                ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            {rule.name}
          </button>
          <button
            onClick={() => deleteRule(rule.name)}
            aria-label={`Delete rule ${rule.name}`}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0 text-xs text-red-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );

  const createForm = creating ? (
    <div className="mt-3 p-3 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50/50 dark:bg-amber-950/50 space-y-2">
      <input
        type="text"
        placeholder="rule-name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
      />
      <textarea
        placeholder="Content (optional)"
        value={newContent}
        onChange={(e) => setNewContent(e.target.value)}
        rows={3}
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 resize-none"
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
          className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => setCreating(true)}
      className="mt-3 w-full text-[13px] border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg py-1.5 transition-colors"
    >
      + New Rule
    </button>
  );

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Rules</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{rules.length} conditional rules</p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      {rules.length === 0 && !creating ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <EmptyState
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
              </svg>
            }
            title="No rules yet"
            description="Conditional rules tell Claude what to do (or not do) when certain triggers fire."
            action={{ label: "Create rule", onClick: () => setCreating(true) }}
          />
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="lg:hidden">
            {!selected ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
                {ruleList}
                {createForm}
              </div>
            ) : (
              <div>
                <button onClick={() => setSelected(null)} className="mb-3 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                  Back to list
                </button>
                <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} onSave={saveRule} />
              </div>
            )}
          </div>

          {/* Desktop: resizable */}
          <div className="hidden lg:block h-[calc(100vh-8rem)]">
            <Group id="rules-panels" orientation="horizontal" defaultLayout={{ list: 28, detail: 72 }}>
              <Panel id="list" minSize="18%" maxSize="50%">
                <div className="h-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm overflow-y-auto">
                  {ruleList}
                  {createForm}
                </div>
              </Panel>
              <ResizeHandle />
              <Panel id="detail" minSize="40%">
                <div className="h-full overflow-y-auto pr-1">
                  {selected ? (
                    <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} onSave={saveRule} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">Select a rule to view</div>
                  )}
                </div>
              </Panel>
            </Group>
          </div>
        </>
      )}
      {confirmDialog}
    </div>
  );
}
