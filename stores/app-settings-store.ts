import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppSettingsState {
  pollingEnabled: boolean;
  pollingInterval: number;
  navOrder: string[] | null;
  setPollingEnabled: (enabled: boolean) => void;
  setPollingInterval: (seconds: number) => void;
  setNavOrder: (order: string[]) => void;
  resetNavOrder: () => void;
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      pollingEnabled: true,
      pollingInterval: 5,
      navOrder: null,
      setPollingEnabled: (enabled) => set({ pollingEnabled: enabled }),
      setPollingInterval: (seconds) => set({ pollingInterval: seconds }),
      setNavOrder: (order) => set({ navOrder: order }),
      resetNavOrder: () => set({ navOrder: null }),
    }),
    {
      name: "harness-hub-settings",
    }
  )
);
