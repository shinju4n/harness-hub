import { create } from "zustand";

interface ConfigState {
  loading: boolean;
  error: string | null;
  config: Record<string, unknown> | null;
  fetchConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  loading: false,
  error: null,
  config: null,

  fetchConfig: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/config");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch config");
      }
      const config = await res.json();
      set({ config, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
}));
