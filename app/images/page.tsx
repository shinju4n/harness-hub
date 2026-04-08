"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshButton } from "@/components/refresh-button";
import { apiFetch, getApiHeaders } from "@/lib/api-client";
import { useAppSettingsStore } from "@/stores/app-settings-store";

interface ImageEntry {
  id: string;
  projectDir: string;
  projectLabel: string;
  sessionId: string;
  fileName: string;
  messageUuid: string;
  blockIndex: number;
  timestamp: number;
  mediaType: string;
  sizeBytes: number;
}

interface ImagePage {
  entries: ImageEntry[];
  total: number;
  projects?: ProjectFacet[];
}

interface ProjectFacet {
  dir: string;
  label: string;
  count: number;
}

const PAGE_SIZE = 60;

function formatTimestamp(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function imageSrc(id: string, homeOverride: string | undefined): string {
  // <img> tags can't send custom headers, so we encode the active profile's
  // home path as a query param. The /api/images/[id] route validates it via
  // the same `getClaudeHome` hygiene check used for the header.
  const base = `/api/images/${encodeURIComponent(id)}`;
  return homeOverride ? `${base}?home=${encodeURIComponent(homeOverride)}` : base;
}

export default function ImagesPage() {
  const [page, setPage] = useState<ImagePage | null>(null);
  const [projects, setProjects] = useState<ProjectFacet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  // Map of thumbnail id → DOM node, kept fresh by each thumbnail's `ref`
  // callback. We look up the opener at lightbox-close time so a background
  // refresh / pagination that re-mounts the thumbnail still routes focus
  // back to the correct (current) DOM node, never a detached one.
  const thumbnailRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const lightboxCloseRef = useRef<HTMLButtonElement | null>(null);
  /**
   * Cancels the in-flight fetch (if any) so a stale request that was
   * triggered before a filter/profile change cannot resolve last and
   * overwrite the newer page. Stored in a ref so the cancellation is
   * stable across re-renders.
   */
  const inflightAbortRef = useRef<AbortController | null>(null);

  // Subscribe to the active profile so a soft profile switch (no reload)
  // re-derives image URLs. Today the profile dropdown forces a full reload,
  // but if that ever changes the gallery still works.
  const activeProfileId = useAppSettingsStore((s) => s.activeProfileId);
  // `getApiHeaders()` reads from the store imperatively, so we re-derive
  // it on every render keyed implicitly by `activeProfileId` (which is in
  // the dep list of the effects below). Don't `useMemo` — that's how the
  // first-pass review caught a stale snapshot.
  void activeProfileId;
  const homeOverride = getApiHeaders()["x-claude-home"];

  /**
   * Load a page of images. Always cancels any in-flight load first so
   * concurrent requests cannot race — whichever was started most recently
   * is the one whose result lands in state. `embedFacets: true` asks the
   * API to return entries + facet map in a single jsonl walk, used on
   * first load and filter changes.
   */
  const load = useCallback(
    async (nextOffset: number, embedFacets: boolean) => {
      // Cancel whatever was previously running. The aborted fetch's
      // promise rejects with `AbortError`, which we catch and ignore.
      inflightAbortRef.current?.abort();
      const controller = new AbortController();
      inflightAbortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
        if (projectFilter) params.set("project", projectFilter);
        if (embedFacets) params.set("facets", "embed");
        const res = await apiFetch(`/api/images?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as ImagePage;
        // If a newer load started while we were awaiting, the controller
        // we hold is no longer the "current" one — drop the result.
        if (inflightAbortRef.current !== controller) return;
        setPage(data);
        if (embedFacets && data.projects) setProjects(data.projects);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        if (inflightAbortRef.current !== controller) return;
        setError(err instanceof Error ? err.message : "Failed to load images");
        setPage(null);
      } finally {
        if (inflightAbortRef.current === controller) {
          setLoading(false);
        }
      }
    },
    [projectFilter]
  );

  // Initial mount + filter/profile change: pull entries + facets in one walk.
  // Resetting offset to 0 here is deliberate: a profile/filter change
  // invalidates the previous page index entirely.
  useEffect(() => {
    setOffset(0);
    void load(0, true);
  }, [activeProfileId, projectFilter, load]);

  // Pagination clicks: only refetch entries (no facets walk).
  // Early-returns when offset is 0 because the filter-change effect above
  // already loaded that page; without this guard the two effects would
  // race and double-fetch on filter change. The AbortController above is
  // belt-and-suspenders for any other path that triggers the same race.
  useEffect(() => {
    if (offset === 0) return;
    void load(offset, false);
  }, [offset, load]);

  // Cancel any in-flight fetch on unmount.
  useEffect(() => {
    return () => {
      inflightAbortRef.current?.abort();
    };
  }, []);

  const total = page?.total ?? 0;
  const entries = page?.entries ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const lightbox = lightboxId ? entries.find((e) => e.id === lightboxId) ?? null : null;

  // Lightbox: Esc to close, return focus to opener, autofocus close button.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxId(null);
    };
    window.addEventListener("keydown", onKey);
    // Focus the close button so screen readers/keyboard users have a clear
    // entry point.
    requestAnimationFrame(() => lightboxCloseRef.current?.focus());
    const openerId = lightbox.id;
    return () => {
      window.removeEventListener("keydown", onKey);
      // Restore focus to the (current) thumbnail node for this id. Looked
      // up via `thumbnailRefs` so a re-mount between open and close still
      // routes focus to the right DOM element rather than a detached one.
      thumbnailRefs.current.get(openerId)?.focus();
    };
  }, [lightbox]);

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Images</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Every image attached to a Claude Code conversation, across all sessions
          </p>
        </div>
        <RefreshButton onRefresh={() => { setOffset(0); void load(0, true); }} />
      </div>

      {/* Filter row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-amber-400"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.dir} value={p.dir}>
              {p.label} ({p.count})
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {total} {total === 1 ? "image" : "images"}
        </span>
      </div>

      {/* Grid */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300 mb-4">
          {error}
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div className="text-sm text-gray-400 dark:text-gray-500 py-12 text-center">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No images found in this Claude home.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Attach an image in a Claude Code conversation and it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              ref={(node) => {
                if (node) thumbnailRefs.current.set(entry.id, node);
                else thumbnailRefs.current.delete(entry.id);
              }}
              onClick={() => setLightboxId(entry.id)}
              className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-amber-300 dark:hover:border-amber-700 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
              title={`${entry.projectLabel} · ${formatTimestamp(entry.timestamp)}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc(entry.id, homeOverride)}
                alt={`Image from ${entry.projectLabel}`}
                loading="lazy"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white truncate">{entry.projectLabel.split("/").pop() || entry.projectDir}</p>
                <p className="text-[10px] text-white/70 truncate">{formatTimestamp(entry.timestamp)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Image from ${lightbox.projectLabel}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightboxId(null)}
        >
          <div className="relative max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc(lightbox.id, homeOverride)}
              alt={`Image from ${lightbox.projectLabel}`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="mt-3 px-4 py-3 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">Project</span>
                <span className="font-mono text-xs truncate">{lightbox.projectLabel}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">Session</span>
                <span className="font-mono text-xs truncate">{lightbox.sessionId}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">Captured</span>
                <span className="font-mono text-xs">{formatTimestamp(lightbox.timestamp)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-gray-400">Type · Size</span>
                <span className="font-mono text-xs">{lightbox.mediaType} · {formatBytes(lightbox.sizeBytes)}</span>
              </div>
            </div>
            <button
              ref={lightboxCloseRef}
              type="button"
              onClick={() => setLightboxId(null)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
              aria-label="Close image preview"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
