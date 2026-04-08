"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RULES } from "@/lib/harness-score/catalog";
import { SEVERITY_PENALTY } from "@/lib/harness-score/types";
import type { Category } from "@/lib/harness-score/types";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  SEVERITY_BADGE,
} from "@/lib/harness-score/labels";

interface ScoringCriteriaModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * When provided, the modal renders only the rules for that category and
   * uses a category-specific title. When omitted, all categories are shown.
   */
  category?: Category;
}

export function ScoringCriteriaModal({
  open,
  onClose,
  category,
}: ScoringCriteriaModalProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Tracks where mousedown originated so we only treat a backdrop click as
  // "close" when both press AND release happened on the backdrop. This
  // mirrors native dialog behavior — a press inside the dialog that ends
  // outside it (selection drag) must NOT close.
  const mouseDownOnBackdrop = useRef(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus management: remember the previously focused element, move focus
  // into the dialog (the dialog container itself, not the close button — so
  // screen readers announce the dialog title first per WAI-ARIA APG), and
  // restore focus on close. Also lock body scroll while open so the page
  // underneath doesn't scroll behind the modal.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => dialogRef.current?.focus(), 0);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(t);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Focus trap: keep Tab/Shift+Tab inside the dialog. The selector covers
  // the standard interactive set so future revisions of this modal that
  // add inputs/selects/textareas/contenteditable regions stay trapped
  // without revisiting this hook.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        [
          'a[href]',
          'button:not([disabled])',
          'input:not([disabled]):not([type="hidden"])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[contenteditable="true"]',
          '[tabindex]:not([tabindex="-1"])',
        ].join(", "),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || !mounted) return null;

  const visibleCategories: Category[] = category ? [category] : [...CATEGORIES];
  const titleSuffix = category ? ` — ${CATEGORY_LABELS[category]}` : "";

  return createPortal(
    <div
      className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        // Record whether the press started on the backdrop. We DO NOT
        // close on mousedown alone — that would close on a press-inside-
        // drag-outside-release, which is the opposite of native dialogs.
        mouseDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (mouseDownOnBackdrop.current && e.target === e.currentTarget) {
          onClose();
        }
        mouseDownOnBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scoring-criteria-title"
        // tabIndex=-1 makes the container itself focusable (without putting
        // it in tab order) so initial focus can land on the dialog and the
        // first announced element is the title, not the close button.
        tabIndex={-1}
        className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden focus:outline-none"
      >
        <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="scoring-criteria-title"
                className="text-base font-semibold text-gray-900 dark:text-gray-100"
              >
                Scoring criteria{titleSuffix}
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Each rule below comes from an explicit warning or recommendation
                in the official Claude Code docs. Anthropic doesn&apos;t publish
                a formal rubric — this is a community-style audit.
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-2">
              <p className="font-medium text-gray-700 dark:text-gray-300">
                Scoring model
              </p>
              <ul className="mt-1 space-y-0.5 text-gray-500 dark:text-gray-400">
                <li>• Each category starts at 100</li>
                <li>
                  • <code>error</code> -{SEVERITY_PENALTY.error},{" "}
                  <code>warn</code> -{SEVERITY_PENALTY.warn},{" "}
                  <code>info</code> -{SEVERITY_PENALTY.info}
                </li>
                <li>• Overall = average of scored categories</li>
                <li>• Empty category with 0 findings = n/a</li>
              </ul>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-2">
              <p className="font-medium text-gray-700 dark:text-gray-300">
                De-duplication
              </p>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                The same rule firing on multiple items only counts up to
                <strong> 3 hits</strong> for scoring. 20 agents missing the same
                optional field is one configuration pattern, not 20 separate
                problems. The full finding list is still shown.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {visibleCategories.map((cat) => {
            const rules = Object.entries(RULES).filter(
              ([, spec]) => spec.category === cat,
            );
            return (
              <section key={cat}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <ul className="space-y-2">
                  {rules.map(([id, rule]) => (
                    <li
                      key={id}
                      className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-3"
                    >
                      <div className="flex items-start gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${SEVERITY_BADGE[rule.severity]}`}
                        >
                          {rule.severity}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-500">
                          −{SEVERITY_PENALTY[rule.severity]}
                        </span>
                        <code className="text-[10px] text-gray-400 dark:text-gray-500">
                          {id}
                        </code>
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                        {rule.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {rule.rationale}
                      </p>
                      <a
                        href={rule.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
                      >
                        Docs ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-950/50 border-t border-gray-100 dark:border-gray-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
