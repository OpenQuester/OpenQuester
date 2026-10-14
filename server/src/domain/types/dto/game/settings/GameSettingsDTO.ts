/** How the server picks the answerer when several players press */
export enum ButtonPressMode {
  /** Presses inside a short window after the first one are drawn at random */
  RANDOM_WITHIN_WINDOW = "random_within_window",
  /** The first press to reach the server answers */
  FIRST_WINS = "first_wins"
}

/** Rules the host chooses when creating a game */
export interface GameSettingsDTO {
  /**
   * The buzzer opens after the question content (and a caption's reading
   * time); a press before that locks the player out for a moment. When off,
   * players may press at any time.
   */
  falseStart: boolean;
  buttonPressMode: ButtonPressMode;
}

export const DEFAULT_GAME_SETTINGS: Readonly<GameSettingsDTO> = Object.freeze({
  falseStart: true,
  buttonPressMode: ButtonPressMode.RANDOM_WITHIN_WINDOW
});

/** Fills missing settings (older games, partial input) with the defaults */
export function normalizeGameSettings(
  settings: Partial<GameSettingsDTO> | null | undefined
): GameSettingsDTO {
  return { ...DEFAULT_GAME_SETTINGS, ...(settings ?? {}) };
}
