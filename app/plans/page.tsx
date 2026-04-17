"use client";

import { useState } from "react";
import { Panel, Group } from "react-resizable-panels";
import { MarkdownViewer } from "@/components/markdown-viewer-dynamic";
import { RefreshButton } from "@/components/refresh-button";
import { EmptyState } from "@/components/empty-state";
import { ResizeHandle } from "@/components/resize-handle";
import { useConfirm } from "@/components/confirm-dialog";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";
import { useToastStore } from "@/stores/toast-store";

interface PlanSummary {
  name: string;
  fileName: string;
  title: string;
  description: string;
  mtime: number;
}

interface PlanDetail {
  name: string;
  fileName: string;
  frontmatter: Record<string, unknown>;
  content: string;
  rawContent: string;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [selected, setSelected] = useState<PlanDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const pushToast = useToastStore((s) => s.push);

  const fetchPlans = () => {
    apiFetch("/api/plans").then((r) => r.json()).then((d) => setPlans(d.plans ?? []));
  };

  const { refresh } = usePolling(fetchPlans);

  const viewPlan = async (name: string) => {
    const res = await apiFetch(`/api/plans?name=${encodeURIComponent(name)}`);
    if (res.ok) {
      const data = await res.json();
      setSelected(data);
    }
  };

  const savePlan = async (rawContent: string) => {
    if (!selected) return;
    const res = await apiFetch("/api/plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selected.name, content: rawContent }),
    });
    if (res.ok) {
      // Re-read so frontmatter / content are re-parsed from the new raw text.
      await viewPlan(selected.name);
      fetchPlans();
    }
  };

  const deletePlan = async (name: string) => {
    const ok = await confirm({
      title: "Delete plan",
      message: `"${name}" will be removed from ~/.claude/plans/. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await apiFetch(`/api/plans?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      pushToast("success", `Plan "${name}" deleted`);
      if (selected?.name === name) setSelected(null);
      fetchPlans();
    } else {
      const err = await res.json().catch(() => ({}));
      pushToast("error", err.error ?? `Failed to delete "${name}"`);
    }
  };

  const createPlan = async () => {
    setCreateError(null);
    const name = newName.trim();
    if (!name) return;
    const body = newContent.trim() || `# ${name}\n`;
    const res = await apiFetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content: body }),
    });
    if (res.ok) {
      setCreating(false);
      setNewName("");
      setNewContent("");
      fetchPlans();
      viewPlan(name);
    } else {
      const err = await res.json().catch(() => ({ error: "create failed" }));
      setCreateError(err.error ?? "create failed");
    }
  };

  const planList = (
    <div className="space-y-0.5">
      {plans.length === 0 ? (
        <EmptyState
          compact
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="8" y="2" width="8" height="4" rx="1"/>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <path d="M9 12h6"/><path d="M9 16h6"/>
            </svg>
          }
          title="No plans yet"
          description="Plans capture multi-step ideas Claude can hand off, refine, or revisit later."
          action={{ label: "Create plan", onClick: () => setCreating(true) }}
        />
      ) : (
        plans.map((plan) => (
          <div key={plan.fileName} className="flex items-start gap-1 group">
            <button
              onClick={() => viewPlan(plan.name)}
              className={`flex-1 text-left px-3 py-2.5 rounded-lg text-[13px] transition-all ${
                selected?.name === plan.name
                  ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <div className="truncate">{plan.title}</div>
              {plan.description && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">
                  {plan.description}
                </p>
              )}
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5 truncate">
                {plan.fileName}
              </p>
            </button>
            <button
              onClick={() => deletePlan(plan.name)}
              aria-label={`Delete plan ${plan.title}`}
              className="mt-2 shrink-0 text-xs text-gray-300 dark:text-gray-700 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:text-red-500 transition-colors px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
            >
              Delete
            </button>
          </div>
        ))
      )}
    </div>
  );

  const createForm = creating ? (
    <div className="mt-3 p-3 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50/50 dark:bg-amber-950/50 space-y-2">
      <input
        type="text"
        placeholder="plan-slug"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
      />
      <textarea
        placeholder="Initial markdown (optional)"
        value={newContent}
        onChange={(e) => setNewContent(e.target.value)}
        rows={4}
        className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 resize-none"
      />
      {createError && <p className="text-[11px] text-red-500">{createError}</p>}
      <div className="flex gap-1.5">
        <button
          onClick={createPlan}
          className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => { setCreating(false); setNewName(""); setNewContent(""); setCreateError(null); }}
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
      + New Plan
    </button>
  );

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Plans</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {plans.length} plan{plans.length === 1 ? "" : "s"} in ~/.claude/plans/
          </p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      {/* Mobile */}
      <div className="lg:hidden">
        {!selected ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
            {planList}
            {createForm}
          </div>
        ) : (
          <div>
            <button
              onClick={() => setSelected(null)}
              className="mb-3 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
              Back to list
            </button>
            <MarkdownViewer
              key={selected.name}
              content={selected.content}
              rawContent={selected.rawContent}
              fileName={selected.fileName}
              onSave={savePlan}
            />
          </div>
        )}
      </div>

      {/* Desktop: resizable */}
      <div className="hidden lg:block h-[calc(100vh-8rem)]">
        <Group id="plans-panels" orientation="horizontal" defaultLayout={{ list: 28, detail: 72 }}>
          <Panel id="list" minSize="18%" maxSize="50%">
            <div className="h-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm overflow-y-auto">
              {planList}
              {createForm}
            </div>
          </Panel>
          <ResizeHandle />
          <Panel id="detail" minSize="40%">
            <div className="h-full overflow-y-auto pr-1">
              {selected ? (
                <MarkdownViewer
                  key={selected.name}
                  content={selected.content}
                  rawContent={selected.rawContent}
                  fileName={selected.fileName}
                  onSave={savePlan}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  Select a plan to view
                </div>
              )}
            </div>
          </Panel>
        </Group>
      </div>
      {confirmDialog}
    </div>
  );
}
