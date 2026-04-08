import type { Category, Severity } from "./types";

/**
 * Shared display strings for the harness score UI. Both the panel and the
 * criteria modal import from here so the two views can never disagree on
 * how a category is labelled or how severities are styled.
 */

export const CATEGORIES: readonly Category[] = [
  "agents",
  "skills",
  "hooks",
  "permissions",
  "memory",
] as const;

export const CATEGORY_LABELS: Record<Category, string> = {
  agents: "Agents",
  skills: "Skills",
  hooks: "Hooks",
  permissions: "Permissions",
  memory: "CLAUDE.md",
};

export const SEVERITY_DOT: Record<Severity, string> = {
  error: "bg-red-500",
  warn: "bg-amber-500",
  info: "bg-blue-500",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  error: "text-red-600 dark:text-red-400",
  warn: "text-amber-600 dark:text-amber-400",
  info: "text-blue-600 dark:text-blue-400",
};

export const SEVERITY_BADGE: Record<Severity, string> = {
  error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

/** Tiny pluralization helper used by the panel. */
export function plural(n: number, singular: string, plural?: string): string {
  return n === 1 ? singular : (plural ?? singular + "s");
}
