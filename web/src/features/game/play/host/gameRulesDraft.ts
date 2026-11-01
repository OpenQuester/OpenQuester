import type { GameSettings as FullGameSettings } from "@/api/types";
import { DEFAULT_GAME_SETTINGS } from "@/features/create-game/gameSettings";
import type { GameSettings, GameSettingsChange } from "@/game/protocol";

/** The game's rules with every timer filled in, ready for the rules form. */
export function fullGameSettings(settings: GameSettings | null): FullGameSettings {
  return {
    ...DEFAULT_GAME_SETTINGS,
    ...settings,
    wrongAnswerPenalty: settings?.wrongAnswerPenalty ?? DEFAULT_GAME_SETTINGS.wrongAnswerPenalty,
    timers: { ...DEFAULT_GAME_SETTINGS.timers, ...settings?.timers },
  };
}

/** Only what the draft changed, so the server keeps every other rule as it is; null when nothing did. */
export function gameSettingsChange(
  current: FullGameSettings,
  draft: FullGameSettings,
): GameSettingsChange | null {
  const change: GameSettingsChange = {};
  if (draft.falseStart !== current.falseStart) change.falseStart = draft.falseStart;
  if (draft.buttonPressMode !== current.buttonPressMode)
    change.buttonPressMode = draft.buttonPressMode;
  if (draft.wrongAnswerPenalty !== current.wrongAnswerPenalty)
    change.wrongAnswerPenalty = draft.wrongAnswerPenalty;
  const timers: Record<string, number> = {};
  for (const key of Object.keys(draft.timers) as (keyof FullGameSettings["timers"])[]) {
    if (draft.timers[key] !== current.timers[key]) timers[key] = draft.timers[key];
  }
  if (Object.keys(timers).length > 0) change.timers = timers;
  return Object.keys(change).length > 0 ? change : null;
}
