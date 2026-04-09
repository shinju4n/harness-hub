"use client";

import { useEffect } from "react";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useVersionHistoryStore } from "@/stores/version-history-store";
import { apiFetch } from "@/lib/api-client";

declare global {
  interface Window {
    electronVersionStore?: {
      getBasePath: () => Promise<string>;
      onWindowRegainFocus: (cb: () => void) => () => void;
    };
  }
}

export function VersionHistoryProvider({ children }: { children: React.ReactNode }) {
  const setUserDataPath = useVersionHistoryStore((s) => s.setUserDataPath);
  const resetForProfile = useVersionHistoryStore((s) => s.resetForProfile);

  useEffect(() => {
    let focusCleanup: (() => void) | undefined;
    let debounceTimer: ReturnType<typeof setTimeout>;

    async function init() {
      if (window.electronVersionStore) {
        try {
          const basePath = await window.electronVersionStore.getBasePath();
          setUserDataPath(basePath);
          (globalThis as Record<string, unknown>).__harnessHubUserDataPath = basePath;
        } catch { /* non-Electron environment */ }
      }

      // Launch rescan (best effort)
      try { await apiFetch("/api/rescan", { method: "POST" }); } catch {}

      // Focus event listener (debounced)
      if (window.electronVersionStore) {
        focusCleanup = window.electronVersionStore.onWindowRegainFocus(() => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            apiFetch("/api/rescan", { method: "POST" }).catch(() => {});
          }, 2000);
        });
      }
    }

    init();

    // Profile change subscription — zustand v5 subscribe passes (state, prevState)
    const unsub = useAppSettingsStore.subscribe((state, prevState) => {
      if (state.activeProfileId !== prevState.activeProfileId) {
        resetForProfile();
        apiFetch("/api/rescan", { method: "POST" }).catch(() => {});
      }
    });

    return () => {
      unsub();
      focusCleanup?.();
      clearTimeout(debounceTimer);
    };
  }, [setUserDataPath, resetForProfile]);

  return <>{children}</>;
}
