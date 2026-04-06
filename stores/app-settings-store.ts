import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppSettingsState {
  pollingEnabled: boolean;
  pollingInterval: number; // seconds
  setPollingEnabled: (enabled: boolean) => void;
  setPollingInterval: (seconds: number) => void;
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      pollingEnabled: true,
      pollingInterval: 5,
      setPollingEnabled: (enabled) => set({ pollingEnabled: enabled }),
      setPollingInterval: (seconds) => set({ pollingInterval: seconds }),
    }),
    {
      name: "harness-hub-settings",
    }
  )
);
