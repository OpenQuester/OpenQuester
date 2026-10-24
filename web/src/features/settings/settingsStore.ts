import { create } from "zustand";

import { detectLanguage, i18n, type LanguageId } from "@/i18n/index";
import { safeStorage } from "@/lib/storage";
import { applyTheme, DEFAULT_THEME, THEMES } from "@/theme/themes";

export interface Settings {
  theme: string;
  language: LanguageId;
  sound: boolean;
  reduceMotion: boolean;
  /** 0..1 */
  volume: number;
  /** In-game side panels kept open on wide screens (this device only). */
  pins: Partial<Record<PanelId, boolean>>;
  /** Re-encode package media in the browser before uploading it. */
  compressMedia: boolean;
}

export type PanelId = "host" | "players" | "chat";

const KEY = "oq.settings";

function load(): Settings {
  let saved: Partial<Settings> = {};
  try {
    const value: unknown = JSON.parse(safeStorage.get(KEY) ?? "{}");
    if (value && typeof value === "object" && !Array.isArray(value)) saved = value;
  } catch {
    saved = {};
  }
  return {
    theme: THEMES.some((theme) => theme.available && theme.id === saved.theme)
      ? saved.theme!
      : DEFAULT_THEME,
    language: detectLanguage(typeof saved.language === "string" ? saved.language : undefined),
    sound: typeof saved.sound === "boolean" ? saved.sound : true,
    reduceMotion: saved.reduceMotion === true,
    volume:
      typeof saved.volume === "number" && Number.isFinite(saved.volume)
        ? Math.max(0, Math.min(1, saved.volume))
        : 0.7,
    pins: {
      host: saved.pins?.host === true,
      players: saved.pins?.players === true,
      chat: saved.pins?.chat === true,
    },
    compressMedia: typeof saved.compressMedia === "boolean" ? saved.compressMedia : true,
  };
}

function applyAll(s: Settings) {
  applyTheme(s.theme);
  document.documentElement.lang = s.language;
  if (s.reduceMotion) document.documentElement.dataset.motion = "reduced";
  else delete document.documentElement.dataset.motion;
  if (i18n.language !== s.language) void i18n.changeLanguage(s.language);
}

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  update: (patch) => {
    set(patch);
    const { update: _u, ...rest } = get();
    safeStorage.set(KEY, JSON.stringify(rest));
    applyAll(rest);
  },
}));

export function initSettings(): void {
  const { update: _u, ...rest } = useSettings.getState();
  applyAll(rest);
}
