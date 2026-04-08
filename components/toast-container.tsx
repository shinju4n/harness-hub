"use client";

import { useEffect } from "react";
import { useToastStore } from "@/stores/toast-store";
import type { Toast } from "@/stores/toast-store";

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const delay = toast.kind === "error" ? 5000 : 3000;
    const timer = setTimeout(() => dismiss(toast.id), delay);
    return () => clearTimeout(timer);
  }, [toast.id, toast.kind, dismiss]);

  const borderColor =
    toast.kind === "success"
      ? "border-green-300 dark:border-green-700"
      : toast.kind === "error"
      ? "border-red-300 dark:border-red-700"
      : "border-amber-300 dark:border-amber-700";

  const iconColor =
    toast.kind === "success"
      ? "text-green-500"
      : toast.kind === "error"
      ? "text-red-500"
      : "text-amber-500";

  const icon =
    toast.kind === "success" ? (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={iconColor}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ) : toast.kind === "error" ? (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={iconColor}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={iconColor}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    );

  return (
    <div
      className={`flex items-start gap-2.5 min-w-[240px] max-w-sm px-3.5 py-3 rounded-xl border bg-white dark:bg-gray-900 shadow-lg text-sm text-gray-700 dark:text-gray-200 transition-opacity duration-200 ${borderColor}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => dismiss(toast.id)}
        className="shrink-0 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
