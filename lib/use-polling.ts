"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAppSettingsStore } from "@/stores/app-settings-store";

export function usePolling(fetchFn: () => void, deps: unknown[] = []) {
  const { pollingEnabled, pollingInterval } = useAppSettingsStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const refresh = useCallback(() => {
    fetchRef.current();
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchRef.current();
  }, deps);

  // Polling
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (pollingEnabled && pollingInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchRef.current();
      }, pollingInterval * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pollingEnabled, pollingInterval]);

  return { refresh };
}
