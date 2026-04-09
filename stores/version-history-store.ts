import { create } from "zustand";

interface VersionHistoryState {
  userDataPath: string | null;
  isHistoryOpen: boolean;
  selectedSnapshotId: string | null;
  compareSnapshotId: string | null;

  setUserDataPath: (path: string) => void;
  toggleHistory: () => void;
  openHistory: () => void;
  closeHistory: () => void;
  selectSnapshot: (id: string | null) => void;
  setCompareSnapshot: (id: string | null) => void;
  resetForProfile: () => void;
}

export const useVersionHistoryStore = create<VersionHistoryState>()((set) => ({
  userDataPath: null,
  isHistoryOpen: false,
  selectedSnapshotId: null,
  compareSnapshotId: null,

  setUserDataPath: (path) => set({ userDataPath: path }),
  toggleHistory: () => set((s) => ({ isHistoryOpen: !s.isHistoryOpen })),
  openHistory: () => set({ isHistoryOpen: true }),
  closeHistory: () => set({ isHistoryOpen: false }),
  selectSnapshot: (id) => set({ selectedSnapshotId: id }),
  setCompareSnapshot: (id) => set({ compareSnapshotId: id }),
  resetForProfile: () => set({
    isHistoryOpen: false,
    selectedSnapshotId: null,
    compareSnapshotId: null,
  }),
}));
