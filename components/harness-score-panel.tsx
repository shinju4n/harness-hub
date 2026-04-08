"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { Category, ScoreReport } from "@/lib/harness-score/types";
import {
  CATEGORY_LABELS,
  plural,
  SEVERITY_DOT,
  SEVERITY_LABEL,
} from "@/lib/harness-score/labels";
import { ScoringCriteriaModal } from "./scoring-criteria-modal";

function scoreColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 90) return "text-green-500";
  if (score >= 70) return "text-amber-500";
  return "text-red-500";
}

function scoreBg(score: number | null): string {
  if (score === null) return "bg-gray-100 dark:bg-gray-800";
  if (score >= 90) return "bg-green-50 dark:bg-green-950/30";
  if (score >= 70) return "bg-amber-50 dark:bg-amber-950/30";
  return "bg-red-50 dark:bg-red-950/30";
}

export function HarnessScorePanel() {
  const [report, setReport] = useState<ScoreReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [criteriaCategory, setCriteriaCategory] = useState<Category | null>(null);
  // Tracks the latest in-flight request so a manual refresh aborts the
  // previous one. Without this, double-clicking refresh races: two
  // overlapping requests resolve in unpredictable order and the panel
  // can flash the older result over the newer one.
  const inFlightRef = useRef<AbortController | null>(null);

  const fetchReport = useCallback(async () => {
    inFlightRef.current?.abort();
    const ctl = new AbortController();
    inFlightRef.current = ctl;
    const signal = ctl.signal;

    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/harness-score", { signal });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to compute score");
      }
      const data = (await res.json()) as ScoreReport;
      if (!signal.aborted) setReport(data);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (!signal.aborted) setError((err as Error).message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport();
    return () => inFlightRef.current?.abort();
  }, [fetchReport]);

  if (loading && !report) {
    return (
      <section className="mb-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Computing harness score…
        </p>
      </section>
    );
  }

  if (error || !report) {
    return (
      <section className="mb-8 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-5 text-sm text-red-600 dark:text-red-400">
        Harness score unavailable: {error ?? "no report"}
      </section>
    );
  }

  const totalFindings = report.categories.reduce(
    (sum, c) => sum + c.findings.length,
    0,
  );

  return (
    <section
      aria-labelledby="harness-score-heading"
      className="mb-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3
            id="harness-score-heading"
            className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"
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
              className="text-amber-500"
              aria-hidden="true"
            >
              <path d="M12 2L15 8.5l7 1-5 5 1 7-6-3.5L6 21l1-7-5-5 7-1z" />
            </svg>
            Harness Health Score
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Rule-based audit of your agents, skills, hooks, permissions, and
            CLAUDE.md against Claude Code best practices. Click any category
            for its scoring rules.{" "}
            <span className="italic">Advisory only — not an Anthropic certification.</span>
          </p>
        </div>
        <div className="shrink-0 flex items-start gap-2">
          <button
            type="button"
            onClick={() => void fetchReport()}
            disabled={loading}
            aria-label="Recompute score"
            className="p-2 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={loading ? "animate-spin" : ""}
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path d="M8 16H3v5" />
            </svg>
          </button>
          <div
            className={`flex flex-col items-center justify-center w-20 h-20 rounded-2xl ${scoreBg(report.overall)}`}
          >
            <span
              className={`text-3xl font-bold tabular-nums ${scoreColor(report.overall)}`}
            >
              {report.overall ?? "—"}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              overall
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {report.categories.map((cat) => (
          <button
            key={cat.category}
            type="button"
            onClick={() => setCriteriaCategory(cat.category)}
            aria-label={`View scoring criteria for ${CATEGORY_LABELS[cat.category]}`}
            className={`text-left rounded-xl border border-gray-200 dark:border-gray-800 p-3 transition-colors hover:border-amber-300 dark:hover:border-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${scoreBg(cat.score)}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {CATEGORY_LABELS[cat.category]}
              </span>
              <span
                className={`text-base font-bold tabular-nums ${scoreColor(cat.score)}`}
              >
                {cat.score ?? "n/a"}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
              {cat.evaluated} {plural(cat.evaluated, "item")} ·{" "}
              {cat.findings.length} {plural(cat.findings.length, "finding")}
            </p>
            <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
              View criteria →
            </p>
          </button>
        ))}
      </div>

      <ScoringCriteriaModal
        open={criteriaCategory !== null}
        onClose={() => setCriteriaCategory(null)}
        category={criteriaCategory ?? undefined}
      />

      {totalFindings > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-amber-600 dark:text-amber-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
            aria-expanded={expanded}
          >
            {expanded ? "Hide" : "Show"} {totalFindings}{" "}
            {plural(totalFindings, "finding")}
          </button>

          {expanded && (
            <ul className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
              {report.categories.flatMap((cat, ci) =>
                cat.findings.map((f, fi) => (
                  <li
                    key={`${ci}-${fi}-${f.ruleId}`}
                    className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1 inline-block w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[f.severity]}`}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_LABEL[f.severity]}`}
                          >
                            {f.severity}
                          </span>
                          <code className="text-[10px] text-gray-500 dark:text-gray-400">
                            {f.ruleId}
                          </code>
                        </div>
                        <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                          {f.message}
                        </p>
                        {f.target && (
                          <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-500 truncate">
                            {f.target}
                          </p>
                        )}
                        <a
                          href={f.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          Docs ↗
                        </a>
                      </div>
                    </div>
                  </li>
                )),
              )}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
