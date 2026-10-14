export interface ThemeOption {
  id: string;
  /** i18n key for the visible name. */
  labelKey: string;
  available: boolean;
}

/** Midnight and its light counterpart Daylight ship; the others are planned token sets. */
export const THEMES: ThemeOption[] = [
  { id: "midnight", labelKey: "settings.themes.midnight", available: true },
  { id: "daylight", labelKey: "settings.themes.daylight", available: true },
  { id: "broadcast", labelKey: "settings.themes.broadcast", available: false },
  { id: "bold-pop", labelKey: "settings.themes.boldPop", available: false },
  { id: "soft-party", labelKey: "settings.themes.softParty", available: false },
];

export const DEFAULT_THEME = "midnight";

export function applyTheme(id: string): void {
  const theme = THEMES.find((t) => t.id === id && t.available) ?? THEMES[0]!;
  document.documentElement.dataset.theme = theme.id;
}
