import { create } from "zustand";

import { detectLanguage, i18n, type LanguageId } from "@/i18n";
import { safeStorage } from "@/lib/storage";
import { applyTheme, DEFAULT_THEME } from "@/theme/themes";

export interface Settings {
  theme: string;
  language: LanguageId;
  sound: boolean;
  reduceMotion: boolean;
  /** 0..1 */
  volume: number;
  /** In-game side panels kept open on wide screens (this device only). */
  pins: Partial<Record<PanelId, boolean>>;
}

export type PanelId = "host" | "players" | "chat";

const KEY = "oq.settings";

function load(): Settings {
  let saved: Partial<Settings> = {};
  try {
    saved = JSON.parse(safeStorage.get(KEY) ?? "{}") as Partial<Settings>;
  } catch {
    saved = {};
  }
  return {
    theme: saved.theme ?? DEFAULT_THEME,
    language: detectLanguage(saved.language),
    sound: saved.sound ?? true,
    reduceMotion: saved.reduceMotion ?? false,
    volume: typeof saved.volume === "number" ? saved.volume : 0.7,
    pins: saved.pins && typeof saved.pins === "object" ? saved.pins : {},
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
