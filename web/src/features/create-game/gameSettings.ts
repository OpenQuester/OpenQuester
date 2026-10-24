import type { ButtonPressMode, GameSettings, GameTimerSettings } from "@/api/types";

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  falseStart: true,
  buttonPressMode: "random_within_window",
  wrongAnswerPenalty: "subtract",
  timers: {
    answerMs: 20_500,
    answerSubmitMs: 60_000,
    stakeMs: 30_000,
    secretTransferMs: 30_000,
    allPlayAnswerMs: 45_000,
    finalAnswerMs: 75_000,
    roundMs: 0,
  },
};

/** Seconds each timer can be set to; the server accepts any value in range. */
export const TIMER_CHOICES: Record<Exclude<keyof GameTimerSettings, "roundMs">, number[]> = {
  answerMs: [5, 10, 15, 20.5, 30, 45, 60],
  answerSubmitMs: [10, 20, 30, 45, 60, 90, 120],
  stakeMs: [10, 20, 30, 45, 60],
  secretTransferMs: [10, 20, 30, 45, 60],
  allPlayAnswerMs: [20, 30, 45, 60, 90, 120],
  finalAnswerMs: [30, 45, 60, 75, 90, 120, 180],
};

export const ROUND_MINUTES = [0, 10, 15, 20, 30, 45, 60];

export const PRESS_MODES: ButtonPressMode[] = ["random_within_window", "first_wins"];
