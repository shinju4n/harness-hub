import { create } from "zustand";

interface UnsavedState {
  dirtyKeys: Record<string, true>;
  markDirty: (key: string) => void;
  clearDirty: (key: string) => void;
  hasUnsaved: () => boolean;
}

export const useUnsavedStore = create<UnsavedState>((set, get) => ({
  dirtyKeys: {},

  markDirty: (key: string) =>
    set((state) => ({ dirtyKeys: { ...state.dirtyKeys, [key]: true } })),

  clearDirty: (key: string) =>
    set((state) => {
      const next = { ...state.dirtyKeys };
      delete next[key];
      return { dirtyKeys: next };
    }),

  hasUnsaved: () => Object.keys(get().dirtyKeys).length > 0,
}));
