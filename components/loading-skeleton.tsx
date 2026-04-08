"use client";

interface SkeletonProps {
  className?: string;
}

/**
 * Solid placeholder block with a subtle shimmer. Use directly for one-off
 * stand-ins, or compose with the named presets below for the common page
 * layouts.
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-800/70 ${className}`}
      aria-hidden="true"
    />
  );
}

/** Shared shell that pads + announces the in-progress state to AT users. */
function SkeletonRoot({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

/** Skeleton tuned for the dashboard SummaryCard grid. */
export function DashboardSkeleton() {
  return (
    <SkeletonRoot>
      <div className="mb-8">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </SkeletonRoot>
  );
}

/** Generic vertical list of N rows. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <SkeletonRoot>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </SkeletonRoot>
  );
}
