"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";

interface DiffData {
  oldContents: Record<string, string>;
  newContents: Record<string, string>;
  oldLabel: string;
  newLabel: string;
}

export function useVersionDiff(
  kind: "skill" | "agent",
  name: string | undefined,
  currentContent: string | undefined,
  compareSnapshotId: string | null,
): DiffData | null {
  const [diffData, setDiffData] = useState<DiffData | null>(null);

  useEffect(() => {
    if (!compareSnapshotId || !name || !currentContent) {
      setDiffData(null); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    let cancelled = false;
    async function loadDiff() {
      try {
        const res = await apiFetch(
          `/api/version-history?action=get&kind=${kind}&name=${encodeURIComponent(name!)}&id=${encodeURIComponent(compareSnapshotId!)}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const oldContents = data.contents as Record<string, string>;
        const newContents: Record<string, string> = {};
        const primaryFile = Object.keys(oldContents)[0] ?? (kind === "skill" ? "SKILL.md" : `${name}.md`);
        newContents[primaryFile] = currentContent!;
        if (!cancelled) {
          setDiffData({
            oldContents,
            newContents,
            oldLabel: `${new Date(data.snapshot.createdAt).toLocaleString()}`,
            newLabel: "Current",
          });
        }
      } catch {
        if (!cancelled) setDiffData(null);
      }
    }
    loadDiff();
    return () => { cancelled = true; };
  }, [kind, name, currentContent, compareSnapshotId]);

  return diffData;
}
