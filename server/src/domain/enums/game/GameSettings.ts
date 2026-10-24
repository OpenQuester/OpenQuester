/** How the server picks the answerer when several players press. */
export enum ButtonPressMode {
  /** Draw among presses inside a short window after the first one. */
  RANDOM_WITHIN_WINDOW = "random_within_window",
  /** The first press to reach the server answers. */
  FIRST_WINS = "first_wins"
}

/** What a wrong answer to a buzzer question costs. */
export enum WrongAnswerPenalty {
  SUBTRACT = "subtract",
  NONE = "none"
}
