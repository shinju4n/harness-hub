"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useToastStore } from "@/stores/toast-store";

const HOOK_PREVIEW_JSON = JSON.stringify(
  {
    hooks: {
      PostToolUse: [
        {
          matcher: "Edit|Write",
          hooks: [
            {
              type: "http",
              url: "http://127.0.0.1:3000/api/rescan",
              headers: { "x-harness-hub-hook": "1" },
            },
          ],
        },
      ],
    },
  },
  null,
  2,
);

export function HookSection() {
  const pushToast = useToastStore((s) => s.push);
  const [hookInstalled, setHookInstalled] = useState<boolean | null>(null);
  const [hookLoading, setHookLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    apiFetch("/api/claude-hook")
      .then((r) => r.json())
      .then((data: { installed: boolean }) => setHookInstalled(data.installed))
      .catch(() => setHookInstalled(false));
  }, []);

  const toggleHook = async () => {
    if (hookInstalled === null) return;
    setHookLoading(true);
    try {
      const method = hookInstalled ? "DELETE" : "POST";
      const res = await apiFetch("/api/claude-hook", { method });
      if (res.ok) {
        setHookInstalled(!hookInstalled);
        pushToast("success", hookInstalled ? "Hook uninstalled" : "Hook installed");
      } else {
        pushToast("error", "Failed to update hook");
      }
    } catch {
      pushToast("error", "Failed to update hook");
    }
    setHookLoading(false);
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Real-time Capture</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Automatically snapshot Skills and Agents when Claude Code edits them
          </p>
        </div>
        <button
          onClick={toggleHook}
          disabled={hookInstalled === null || hookLoading}
          aria-pressed={hookInstalled ?? false}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
            hookInstalled ? "bg-amber-500" : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              hookInstalled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setPreviewOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${previewOpen ? "rotate-90" : ""}`}
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          Preview hook JSON
        </button>
        {previewOpen && (
          <pre className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-[11px] font-mono text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
            {HOOK_PREVIEW_JSON}
          </pre>
        )}
      </div>
    </div>
  );
}
