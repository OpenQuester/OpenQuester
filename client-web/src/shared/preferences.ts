import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "system" | "light" | "dark" | "pure-dark";
export type Accent = "cyan" | "violet" | "lime" | "coral";
export type BoardLayout = "rows" | "matrix";

type PreferencesState = {
  theme: Theme;
  accent: Accent;
  boardLayout: BoardLayout;
  reducedMotion: boolean;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
  setBoardLayout: (layout: BoardLayout) => void;
  setReducedMotion: (value: boolean) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "dark",
      accent: "cyan",
      boardLayout: "rows",
      reducedMotion: false,
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setBoardLayout: (boardLayout) => set({ boardLayout }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    { name: "openquester-preferences" },
  ),
);

export function applyPreferences({
  theme,
  accent,
  reducedMotion,
}: PreferencesState) {
  const root = document.documentElement;
  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : theme;
  root.dataset.theme = resolvedTheme;
  root.dataset.accent = accent;
  root.dataset.reducedMotion = String(
    reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
}
