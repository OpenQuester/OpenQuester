import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "system" | "light" | "dark" | "pure-dark";
export type Accent = "cyan" | "violet" | "lime" | "coral";
export type BoardLayout = "rows" | "matrix";
export type Language = "en" | "uk" | "ru";

type PreferencesState = {
  theme: Theme;
  accent: Accent;
  boardLayout: BoardLayout;
  reducedMotion: boolean;
  language: Language;
  /** The guidance line at the top of game screens. */
  inGameTips: boolean;
  /** Keeps the board readable on ultrawide screens. */
  limitLobbyWidth: boolean;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
  setBoardLayout: (layout: BoardLayout) => void;
  setReducedMotion: (value: boolean) => void;
  setLanguage: (language: Language) => void;
  setInGameTips: (value: boolean) => void;
  setLimitLobbyWidth: (value: boolean) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "dark",
      accent: "cyan",
      boardLayout: "rows",
      reducedMotion: false,
      language: "en",
      inGameTips: true,
      limitLobbyWidth: true,
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setBoardLayout: (boardLayout) => set({ boardLayout }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setLanguage: (language) => set({ language }),
      setInGameTips: (inGameTips) => set({ inGameTips }),
      setLimitLobbyWidth: (limitLobbyWidth) => set({ limitLobbyWidth }),
    }),
    { name: "openquester-preferences" },
  ),
);

export function applyPreferences({
  theme,
  accent,
  reducedMotion,
  limitLobbyWidth,
}: Pick<
  PreferencesState,
  "theme" | "accent" | "reducedMotion" | "limitLobbyWidth"
>) {
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
  root.dataset.limitLobbyWidth = String(limitLobbyWidth);
}

/**
 * Applies preferences now and re-applies whenever the OS changes its colour
 * scheme or motion setting. Without the listeners, "System" resolved once at
 * mount and then ignored the OS for the rest of the session.
 */
export function watchPreferences(getState: () => PreferencesState) {
  const reapply = () => applyPreferences(getState());
  reapply();
  const queries = [
    window.matchMedia("(prefers-color-scheme: light)"),
    window.matchMedia("(prefers-reduced-motion: reduce)"),
  ];
  for (const query of queries) query.addEventListener("change", reapply);
  const unsubscribe = usePreferences.subscribe(reapply);
  return () => {
    for (const query of queries) query.removeEventListener("change", reapply);
    unsubscribe();
  };
}
