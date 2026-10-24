import { create } from "zustand";

/** The secret-question recipient picked on the stage, confirmed in the dock. */
const useStore = create<{ target: number | null; set: (id: number | null) => void }>((set) => ({
  target: null,
  set: (target) => set({ target }),
}));

export function useSecretTarget(): [number | null, (id: number | null) => void] {
  return [useStore((s) => s.target), useStore((s) => s.set)];
}
