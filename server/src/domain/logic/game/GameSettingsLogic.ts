import { DEFAULT_GAME_SETTINGS, DEFAULT_GAME_TIMERS } from "domain/constants/gameSettings";
import {
  type GameSettingsDTO,
  type GameSettingsInput
} from "domain/types/dto/game/settings/GameSettingsDTO";

export class GameSettingsLogic {
  /** Complete settings from what the host sent: every missing rule or timer gets its default. */
  public static normalize(settings: GameSettingsInput | null | undefined): GameSettingsDTO {
    return {
      ...DEFAULT_GAME_SETTINGS,
      ...(settings ?? {}),
      timers: { ...DEFAULT_GAME_TIMERS, ...(settings?.timers ?? {}) }
    };
  }
}
