"use client";

import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Smaller padding when nested inside a card. */
  compact?: boolean;
}

/**
 * Standard empty state. Shown in place of a list when there are zero items.
 * Includes an illustrative icon, a brief title, longer help text, and an
 * optional CTA — the four ingredients of a useful empty state per the
 * "tell users what to do next" UX rule.
 */
export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "py-8 px-4" : "py-16 px-6"
      }`}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950 text-amber-500 dark:text-amber-400">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {action.label}
        </button>
      )}
    </div>
  );
}
