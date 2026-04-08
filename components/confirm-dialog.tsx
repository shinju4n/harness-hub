"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export interface ConfirmDialogOptions {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When "danger", the confirm button is rendered red. */
  tone?: "default" | "danger";
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  open: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation dialog. Replaces native `window.confirm` so we get
 * consistent styling, focus management, ESC-to-cancel, and screen-reader
 * support (`role="dialog"`, `aria-modal`, label/description ids).
 *
 * The host component owns `open` so the call site can hold related context
 * (e.g. which item is being deleted) without leaking it into a global store.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  // Focus the confirm button on open and restore focus on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => confirmRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // ESC closes; Enter confirms (when focus is inside the dialog).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busy) onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open || !mounted) return null;

  const confirmClass =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
      : "bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-500";

  return createPortal(
    <div
      className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <div className="px-5 pt-5 pb-3">
          <h2
            id="confirm-dialog-title"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            {title}
          </h2>
          <div
            id="confirm-dialog-message"
            className="mt-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line"
          >
            {message}
          </div>
        </div>
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-950/50 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-3 py-1.5 text-sm font-medium rounded-md text-white transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${confirmClass}`}
          >
            {busy ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Imperative helper hook so call sites can write
 *   const confirm = useConfirm();
 *   if (await confirm({ title, message })) { ... }
 * instead of plumbing local open/cancel state. Renders the dialog inline
 * via the returned `dialog` element which the caller mounts once.
 */
export function useConfirm() {
  const [state, setState] = useState<{
    options: ConfirmDialogOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const dialog = (
    <ConfirmDialog
      open={state !== null}
      title={state?.options.title ?? ""}
      message={state?.options.message ?? ""}
      confirmLabel={state?.options.confirmLabel}
      cancelLabel={state?.options.cancelLabel}
      tone={state?.options.tone}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, dialog };
}
