import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Profile {
  id: string;
  name: string;
  homePath: string; // "auto" = default detection, or absolute path
}

interface AppSettingsState {
  pollingEnabled: boolean;
  pollingInterval: number;
  navOrder: string[] | null;
  profiles: Profile[];
  activeProfileId: string;
  theme: "system" | "light" | "dark";
  setPollingEnabled: (enabled: boolean) => void;
  setPollingInterval: (seconds: number) => void;
  setNavOrder: (order: string[]) => void;
  resetNavOrder: () => void;
  addProfile: (name: string, homePath: string) => void;
  removeProfile: (id: string) => void;
  updateProfile: (id: string, name: string, homePath: string) => void;
  setActiveProfile: (id: string) => void;
  getActiveProfile: () => Profile;
  setTheme: (theme: "system" | "light" | "dark") => void;
}

const DEFAULT_PROFILE: Profile = { id: "default", name: "Default", homePath: "auto" };

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set, get) => ({
      pollingEnabled: true,
      pollingInterval: 5,
      navOrder: null,
      profiles: [DEFAULT_PROFILE],
      activeProfileId: "default",
      theme: "system",
      setPollingEnabled: (enabled) => set({ pollingEnabled: enabled }),
      setPollingInterval: (seconds) => set({ pollingInterval: seconds }),
      setNavOrder: (order) => set({ navOrder: order }),
      resetNavOrder: () => set({ navOrder: null }),
      addProfile: (name, homePath) => {
        const id = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({
          profiles: [...state.profiles, { id, name, homePath }],
        }));
      },
      removeProfile: (id) => {
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
          activeProfileId: state.activeProfileId === id ? "default" : state.activeProfileId,
        }));
      },
      updateProfile: (id, name, homePath) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, name, homePath } : p
          ),
        }));
      },
      setActiveProfile: (id) => set({ activeProfileId: id }),
      setTheme: (theme) => set({ theme }),
      getActiveProfile: () => {
        const { profiles, activeProfileId } = get();
        return profiles.find((p) => p.id === activeProfileId) ?? DEFAULT_PROFILE;
      },
    }),
    {
      name: "harness-hub-settings",
      version: 1,
      migrate: (persisted: unknown) => persisted,
    }
  )
);
