import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// Theming system: semantic CSS variable themes applied via `theme-light` / `theme-dark`.
// Add a new theme by extending ThemeMode and providing a `.theme-<mode>` block in CSS
// that overrides the design tokens (see index.css). Components must rely on semantic
// classes (bg-bg, text-primaryText, border-border, etc.) rather than dark: utilities.
export enum ThemeMode {
  LIGHT = "light",
  DARK = "dark",
  PURE_DARK = "pure-dark", // ultra dark (near-black) variant
}

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = "admin-theme";

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(ThemeMode.DARK);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const toggleMode = useCallback(() => {
    // Cycle LIGHT -> DARK -> PURE_DARK -> LIGHT
    setModeState((prev: ThemeMode) => {
      let next: ThemeMode;
      switch (prev) {
        case ThemeMode.LIGHT:
          next = ThemeMode.DARK;
          break;
        case ThemeMode.DARK:
          next = ThemeMode.PURE_DARK;
          break;
        case ThemeMode.PURE_DARK:
        default:
          next = ThemeMode.LIGHT;
      }
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Initialize from storage or system preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(
        THEME_STORAGE_KEY
      ) as ThemeMode | null;
      if (stored && Object.values(ThemeMode).includes(stored))
        return setModeState(stored);
      // Fallback to prefers-color-scheme
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      setModeState(prefersDark ? ThemeMode.DARK : ThemeMode.LIGHT);
    } catch {
      /* ignore */
    }
  }, []);

  // Apply theme class to root element (no legacy 'dark' class kept)
  useEffect(() => {
    const root = document.documentElement;
    const allThemeClasses = ["theme-light", "theme-dark", "theme-pure-dark"];
    allThemeClasses.forEach((c) => root.classList.remove(c));
    switch (mode) {
      case ThemeMode.DARK:
        root.classList.add("theme-dark");
        break;
      case ThemeMode.PURE_DARK:
        root.classList.add("theme-pure-dark");
        break;
      case ThemeMode.LIGHT:
      default:
        root.classList.add("theme-light");
    }
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
};
