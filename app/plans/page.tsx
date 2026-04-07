"use client";

import { useState } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";

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

  const planList = (
    <div className="space-y-0.5">
      {plans.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          No plans in ~/.claude/plans/
        </p>
      ) : (
        plans.map((plan) => (
          <button
            key={plan.fileName}
            onClick={() => viewPlan(plan.name)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-all ${
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
        ))
      )}
    </div>
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
            <MarkdownViewer content={selected.content} rawContent={selected.rawContent} fileName={selected.fileName} />
          </div>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex gap-6">
        <div className="w-64 shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm self-start sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {planList}
        </div>
        <div className="flex-1 min-w-0">
          {selected ? (
            <MarkdownViewer content={selected.content} rawContent={selected.rawContent} fileName={selected.fileName} />
          ) : (
            <div className="text-gray-400 dark:text-gray-500 text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              Select a plan to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
