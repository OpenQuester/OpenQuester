import { DEFAULT_GAME_SETTINGS, DEFAULT_GAME_TIMERS } from "domain/constants/gameSettings";
import type {
  GameSettingsDTO,
  GameSettingsInput
} from "domain/types/dto/game/settings/GameSettingsDTO";

export class GameSettingsLogic {
  /** Fill omitted creation settings and timer values with independent defaults. */
  public static normalize(settings: GameSettingsInput | null | undefined): GameSettingsDTO {
    return {
      ...DEFAULT_GAME_SETTINGS,
      ...(settings ?? {}),
      timers: { ...DEFAULT_GAME_TIMERS, ...(settings?.timers ?? {}) }
    };
  }

  /** Apply a partial change on top of the current settings. */
  public static merge(current: GameSettingsDTO, change: GameSettingsInput): GameSettingsDTO {
    return this.normalize({
      ...current,
      ...change,
      timers: { ...current.timers, ...(change.timers ?? {}) }
    });
  }
}
